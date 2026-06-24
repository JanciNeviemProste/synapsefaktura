"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { expenseSchema, type ExpenseInput } from "@/lib/validation/expense"
import { round2 } from "@/lib/money"

export type ExpenseActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

const BUCKET = "attachments"

function compute(subtotal: number, vatRate: number) {
  const base = round2(subtotal)
  const vat = round2((base * vatRate) / 100)
  const total = round2(base + vat)
  return {
    subtotal: base,
    vat_total: vat,
    total,
    vat_rate_breakdown: [{ rate: vatRate, base, vat }],
  }
}

function toRow(v: ReturnType<typeof expenseSchema.parse>) {
  const amounts = compute(v.subtotal, v.vatRate)
  return {
    supplier_contact_id: v.supplierContactId ?? null,
    document_number: v.documentNumber ?? null,
    issue_date: v.issueDate || null,
    supply_date: v.supplyDate || null,
    due_date: v.dueDate || null,
    currency: v.currency,
    category: v.category ?? null,
    tax_deductible: v.taxDeductible,
    attachment_url: v.attachmentUrl ?? null,
    notes: v.notes ?? null,
    ...amounts,
  }
}

export async function createExpense(
  input: ExpenseInput,
): Promise<ExpenseActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("expenses")
    .insert({ organization_id: orgId, ...toRow(parsed.data) })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Náklad sa nepodarilo uložiť." }
  revalidatePath("/app/expenses")
  return { ok: true, id: data.id }
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<ExpenseActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("expenses")
    .update(toRow(parsed.data))
    .eq("id", id)
  if (error) return { ok: false, error: "Náklad sa nepodarilo uložiť." }
  revalidatePath("/app/expenses")
  return { ok: true, id }
}

export async function deleteExpense(id: string): Promise<ExpenseActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) return { ok: false, error: "Náklad sa nepodarilo zmazať." }
  revalidatePath("/app/expenses")
  return { ok: true, id }
}

/**
 * Uploads a receipt to the private `attachments` bucket under "{orgId}/expenses/…"
 * using the service role (lazily creating the bucket). Returns the storage path.
 */
export async function uploadAttachment(
  formData: FormData,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Žiadny súbor." }
  }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false })
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_")
  const path = `${orgId}/expenses/${Date.now()}-${safeName}`
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) return { ok: false, error: "Súbor sa nepodarilo nahrať." }
  return { ok: true, path }
}

/** Signed URL for viewing a stored attachment (org membership enforced by RLS on the expense row). */
export async function getAttachmentSignedUrl(
  path: string,
): Promise<string | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId || !path.startsWith(`${orgId}/`)) return null
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10)
  return data?.signedUrl ?? null
}
