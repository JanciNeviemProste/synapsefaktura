"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { writeOutcome } from "@/lib/supabase/affected"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import type { Database } from "@/lib/supabase/database.types"
import {
  contactPersonSchema,
  type ContactPersonInput,
} from "@/lib/validation/contact-person"

type ContactPersonRow = Database["public"]["Tables"]["contact_persons"]["Row"]

export type ContactPersonActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export type ContactPersonListResult =
  | { ok: true; persons: ContactPersonRow[] }
  | { ok: false; error: string }

const SAVE_ERROR = "Kontaktnú osobu sa nepodarilo uložiť."

function toRow(v: ReturnType<typeof contactPersonSchema.parse>) {
  return {
    name: v.name,
    position: v.position ?? null,
    email: v.email || null,
    phone: v.phone ?? null,
    note: v.note ?? null,
  }
}

/**
 * Zhodi priznak hlavnej osoby vsetkym ostatnym osobam klienta. Migracia ma
 * parcialny unique index `contact_persons_one_primary_idx` (contact_id where
 * is_primary), takze DB by druhu hlavnu osobu odmietla — radsej priznak najprv
 * uvolnime, nez by akcia spadla na chybe unique indexu.
 */
async function clearPrimary(
  supabase: SupabaseClient<Database>,
  orgId: string,
  contactId: string,
  exceptId?: string,
) {
  const query = supabase
    .from("contact_persons")
    .update({ is_primary: false })
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("is_primary", true)

  return exceptId ? await query.neq("id", exceptId) : await query
}

/** Nacita osobu v ramci organizacie — zaroven je to kontrola vlastnictva. */
async function loadPerson(
  supabase: SupabaseClient<Database>,
  orgId: string,
  id: string,
) {
  const { data } = await supabase
    .from("contact_persons")
    .select("id, contact_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  return data
}

export async function listContactPersons(
  contactId: string,
): Promise<ContactPersonListResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("contact_persons")
    .select("*")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true })

  if (error) {
    return { ok: false, error: "Kontaktné osoby sa nepodarilo načítať." }
  }
  return { ok: true, persons: data ?? [] }
}

export async function createContactPerson(
  contactId: string,
  input: ContactPersonInput,
): Promise<ContactPersonActionResult> {
  const parsed = contactPersonSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // Klient musi patrit tejto organizacii — cudzi kluc sam o sebe cudziu firmu
  // nezachyti, kontroluje len existenciu riadku v `contacts`.
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!contact) return { ok: false, error: "Klient sa nenašiel." }

  if (parsed.data.isPrimary) {
    const { error } = await clearPrimary(supabase, orgId, contactId)
    if (error) return { ok: false, error: SAVE_ERROR }
  }

  const { data, error } = await supabase
    .from("contact_persons")
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      is_primary: parsed.data.isPrimary,
      ...toRow(parsed.data),
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: SAVE_ERROR }
  revalidatePath("/app/contacts")
  return { ok: true, id: data.id }
}

export async function updateContactPerson(
  id: string,
  input: ContactPersonInput,
): Promise<ContactPersonActionResult> {
  const parsed = contactPersonSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const person = await loadPerson(supabase, orgId, id)
  if (!person) return { ok: false, error: "Kontaktná osoba sa nenašla." }

  if (parsed.data.isPrimary) {
    const { error } = await clearPrimary(supabase, orgId, person.contact_id, id)
    if (error) return { ok: false, error: SAVE_ERROR }
  }

  const { error } = await supabase
    .from("contact_persons")
    .update({ is_primary: parsed.data.isPrimary, ...toRow(parsed.data) })
    .eq("id", id)
    .eq("organization_id", orgId)

  if (error) return { ok: false, error: SAVE_ERROR }
  revalidatePath("/app/contacts")
  return { ok: true, id }
}

/** Prepne hlavnu osobu klienta bez toho, aby sa menili ostatne udaje. */
export async function setPrimaryContactPerson(
  id: string,
): Promise<ContactPersonActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const person = await loadPerson(supabase, orgId, id)
  if (!person) return { ok: false, error: "Kontaktná osoba sa nenašla." }

  const cleared = await clearPrimary(supabase, orgId, person.contact_id, id)
  if (cleared.error) {
    return { ok: false, error: "Hlavnú osobu sa nepodarilo nastaviť." }
  }

  const { error } = await supabase
    .from("contact_persons")
    .update({ is_primary: true })
    .eq("id", id)
    .eq("organization_id", orgId)

  if (error) return { ok: false, error: "Hlavnú osobu sa nepodarilo nastaviť." }
  revalidatePath("/app/contacts")
  return { ok: true, id }
}

export async function deleteContactPerson(
  id: string,
): Promise<ContactPersonActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // Rovnaký dôvod ako pri štítkoch: `contact_persons_delete_admin` pustí len
  // owner/admin a PostgREST pri odfiltrovanom riadku chybu nevráti.
  const { data, error } = await supabase
    .from("contact_persons")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")

  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Kontaktnú osobu sa nepodarilo zmazať." }
  }
  if (outcome.kind === "noRows") {
    const { data: visible } = await supabase
      .from("contact_persons")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return {
      ok: false,
      error: visible
        ? "Kontaktnú osobu môže zmazať len majiteľ alebo správca firmy."
        : "Kontaktná osoba sa nenašla.",
    }
  }
  revalidatePath("/app/contacts")
  return { ok: true, id }
}
