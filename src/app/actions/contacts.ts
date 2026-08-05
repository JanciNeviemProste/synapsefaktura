"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { parseContactsTable } from "@/lib/import/contacts"
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


export type ContactImportOutcome =
  | { ok: true; imported: number; skipped: number; errors: string[] }
  | { ok: false; error: string }

/**
 * Hromadný import klientov z tabuľky.
 *
 * Duplicity sa NEPREPISUJÚ, iba preskočia. Import má pridávať, nie ticho
 * meniť údaje, ktoré si niekto v appke opravil — a používateľ sa aj tak
 * dozvie, koľko riadkov preskočilo a prečo.
 *
 * Zhoda sa hľadá najprv podľa IČO (to je jednoznačné), až potom podľa názvu.
 */
export async function importContacts(
  content: string,
): Promise<ContactImportOutcome> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const parsed = parseContactsTable(content)
  if (parsed.contacts.length === 0) {
    return {
      ok: false,
      error: parsed.errors[0] ?? "V tabuľke nie je ani jeden použiteľný riadok.",
    }
  }

  const { data: existing } = await supabase
    .from("contacts")
    .select("name, ico")
    .eq("organization_id", orgId)

  const byIco = new Set(
    (existing ?? []).map((c) => c.ico?.trim()).filter((v): v is string => !!v),
  )
  const byName = new Set(
    (existing ?? []).map((c) => c.name.trim().toLowerCase()),
  )

  const errors = [...parsed.errors]
  const rows = []
  let skipped = 0

  for (const c of parsed.contacts) {
    if (c.ico && byIco.has(c.ico.trim())) {
      skipped++
      errors.push(`„${c.name}“ už existuje (IČO ${c.ico}), preskočené.`)
      continue
    }
    if (byName.has(c.name.trim().toLowerCase())) {
      skipped++
      errors.push(`„${c.name}“ už existuje, preskočené.`)
      continue
    }
    if (c.ico) byIco.add(c.ico.trim())
    byName.add(c.name.trim().toLowerCase())

    rows.push({
      organization_id: orgId,
      type: c.type,
      name: c.name,
      ico: c.ico ?? null,
      dic: c.dic ?? null,
      ic_dph: c.icDph ?? null,
      street: c.street ?? null,
      city: c.city ?? null,
      postal_code: c.postalCode ?? null,
      country: c.country,
      email: c.email ?? null,
      phone: c.phone ?? null,
      notes: c.notes ?? null,
    })
  }

  if (rows.length === 0) {
    return { ok: true, imported: 0, skipped, errors }
  }

  const { error } = await supabase.from("contacts").insert(rows)
  if (error) {
    return { ok: false, error: "Kontakty sa nepodarilo uložiť." }
  }

  revalidatePath("/app/contacts")
  return { ok: true, imported: rows.length, skipped, errors }
}
