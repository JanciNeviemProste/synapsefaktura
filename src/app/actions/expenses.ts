"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { expenseSchema, type ExpenseInput } from "@/lib/validation/expense"
import {
  expensePaymentSchema,
  type ExpensePaymentInput,
} from "@/lib/validation/expense-payment"
import { addExpensePayment, expensePaymentStatus } from "@/lib/expenses/payment"
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
  // Filtrujeme aj podla organizacie, nielen podla id. Samotna RLS nestaci:
  // pusti VSETKY organizacie, ktorych je pouzivatel clenom, takze clen dvoch
  // firiem by cez podvrhnute id upravil naklad tej druhej.
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }
  const { error } = await supabase
    .from("expenses")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Náklad sa nepodarilo uložiť." }
  revalidatePath("/app/expenses")
  return { ok: true, id }
}

export async function deleteExpense(id: string): Promise<ExpenseActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Náklad sa nepodarilo zmazať." }
  revalidatePath("/app/expenses")
  return { ok: true, id }
}

/**
 * Records a payment against an expense: adds to `paid_amount` (there can be
 * several payments) and recomputes `status`. Without this the expense side of
 * the cash-flow in Prehlady stayed at zero, because nothing ever wrote it.
 */
export async function recordExpensePayment(
  input: ExpensePaymentInput,
): Promise<ExpenseActionResult> {
  const parsed = expensePaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const { expenseId, amount } = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: expense } = await supabase
    .from("expenses")
    .select("total, paid_amount")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!expense) return { ok: false, error: "Náklad sa nenašiel." }

  const paidAmount = addExpensePayment(expense.paid_amount, amount)
  const { error } = await supabase
    .from("expenses")
    .update({
      paid_amount: paidAmount,
      status: expensePaymentStatus(paidAmount, expense.total),
    })
    .eq("id", expenseId)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Úhradu sa nepodarilo uložiť." }

  revalidatePath("/app/expenses")
  // Cash-flow v prehladoch cita `paid_amount`, takze sa musi prepocitat tiez.
  revalidatePath("/app/reports")
  return { ok: true, id: expenseId }
}

/** Zrusi zapisane uhrady nakladu (oprava omylu) — vrati ho na `unpaid`. */
export async function clearExpensePayments(
  id: string,
): Promise<ExpenseActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { error } = await supabase
    .from("expenses")
    .update({ paid_amount: 0, status: "unpaid" })
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Úhradu sa nepodarilo zrušiť." }

  revalidatePath("/app/expenses")
  revalidatePath("/app/reports")
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
