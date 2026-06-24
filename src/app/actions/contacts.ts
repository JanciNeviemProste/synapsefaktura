"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { contactSchema, type ContactInput } from "@/lib/validation/contact"

export type ContactActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function toRow(v: ReturnType<typeof contactSchema.parse>) {
  return {
    type: v.type,
    name: v.name,
    ico: v.ico ?? null,
    dic: v.dic ?? null,
    ic_dph: v.icDph ?? null,
    street: v.street ?? null,
    city: v.city ?? null,
    postal_code: v.postalCode ?? null,
    country: v.country,
    email: v.email || null,
    phone: v.phone ?? null,
    default_due_days: v.defaultDueDays ?? null,
    notes: v.notes ?? null,
  }
}

export async function createContact(
  input: ContactInput,
): Promise<ContactActionResult> {
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ organization_id: orgId, ...toRow(parsed.data) })
    .select("id")
    .single()

  if (error) return { ok: false, error: "Kontakt sa nepodarilo uložiť." }
  revalidatePath("/app/contacts")
  return { ok: true, id: data.id }
}

export async function updateContact(
  id: string,
  input: ContactInput,
): Promise<ContactActionResult> {
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("contacts")
    .update(toRow(parsed.data))
    .eq("id", id)

  if (error) return { ok: false, error: "Kontakt sa nepodarilo uložiť." }
  revalidatePath("/app/contacts")
  return { ok: true, id }
}

export async function deleteContact(id: string): Promise<ContactActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("contacts").delete().eq("id", id)
  if (error) return { ok: false, error: "Kontakt sa nepodarilo zmazať." }
  revalidatePath("/app/contacts")
  return { ok: true, id }
}
