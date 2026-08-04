"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import type { Database } from "@/lib/supabase/database.types"
import {
  bankAccountSchema,
  type BankAccountInput,
  type BankAccountValues,
} from "@/lib/validation/bank-account"

type Db = SupabaseClient<Database>
type BankAccountRow = Database["public"]["Tables"]["bank_accounts"]["Row"]

export type BankAccountActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function toRow(v: BankAccountValues) {
  return {
    iban: v.iban,
    swift: v.swift ?? null,
    bank_name: v.bankName ?? null,
    currency: v.currency,
  }
}

/**
 * Zhodi priznak predvoleneho vsetkym uctom organizacie. Vola sa VZDY tesne pred
 * nastavenim noveho predvoleneho — poradie "najprv zhod vsetky, potom nastav
 * jeden" drzi invariant (max. jeden predvoleny) aj pri suboznych volaniach.
 */
/**
 * Bankový účet smie meniť len majiteľ alebo správca.
 *
 * V projekte inak rolu nevynucuje žiadna server action — členstvo stačí všade
 * a RLS na `bank_accounts` používa `is_org_member`. Tu je to však iné: zmena
 * IBAN mení, kam odberatelia posielajú peniaze, a prejaví sa okamžite na
 * každej ďalšej faktúre aj v QR kóde. Kým sa rolový model nedorieši plošne,
 * je toto miesto jeho najostrejším dôsledkom a guard sem patrí.
 *
 * RLS to sama nedoženie, preto kontrola v akcii.
 */
async function requireManagerRole(
  db: Db,
  orgId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .maybeSingle()
  if (data?.role === "owner" || data?.role === "admin") return { ok: true }
  return {
    ok: false,
    error: "Bankové účty môže meniť len majiteľ alebo správca firmy.",
  }
}

async function clearDefault(db: Db, orgId: string) {
  return db
    .from("bank_accounts")
    .update({ is_default: false })
    .eq("organization_id", orgId)
    .eq("is_default", true)
}

/**
 * Povysi najstarsi zvysny ucet organizacie na predvoleny. Bez toho by po zmazani
 * predvoleneho uctu PDF stratilo platobne udaje aj QR kod.
 */
async function promoteAnotherDefault(db: Db, orgId: string, excludeId: string) {
  const { data } = await db
    .from("bank_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .neq("id", excludeId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data) return

  await clearDefault(db, orgId)
  await db
    .from("bank_accounts")
    .update({ is_default: true })
    .eq("id", data.id)
    .eq("organization_id", orgId)
}

/** Ucty aktivnej organizacie, predvoleny prvy. Prazdne pole, ak firma chyba. */
export async function listBankAccounts(): Promise<BankAccountRow[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const { data } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
  return data ?? []
}

export async function createBankAccount(
  input: BankAccountInput,
): Promise<BankAccountActionResult> {
  const parsed = bankAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const role = await requireManagerRole(supabase, orgId)
  if (!role.ok) return { ok: false, error: role.error }

  // Prvy ucet je vzdy predvoleny — inak by faktura nemala z coho brat platobne udaje.
  const { count } = await supabase
    .from("bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
  const isDefault = parsed.data.isDefault || (count ?? 0) === 0

  if (isDefault) {
    const { error } = await clearDefault(supabase, orgId)
    if (error) return { ok: false, error: "Účet sa nepodarilo uložiť." }
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      organization_id: orgId,
      ...toRow(parsed.data),
      is_default: isDefault,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Účet sa nepodarilo uložiť." }

  revalidatePath("/app/settings")
  return { ok: true, id: data.id }
}

export async function updateBankAccount(
  id: string,
  input: BankAccountInput,
): Promise<BankAccountActionResult> {
  const parsed = bankAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const role = await requireManagerRole(supabase, orgId)
  if (!role.ok) return { ok: false, error: role.error }

  const { data: current } = await supabase
    .from("bank_accounts")
    .select("id, is_default")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!current) return { ok: false, error: "Účet sa nenašiel." }

  // Odobratie priznaku poslednemu uctu by nechalo faktury bez platobnych udajov:
  // ak iny ucet existuje, prevezme ho nizsie, inak priznak drzime.
  let isDefault = parsed.data.isDefault
  const demoting = current.is_default && !isDefault
  if (demoting) {
    const { count } = await supabase
      .from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .neq("id", id)
    if ((count ?? 0) === 0) isDefault = true
  }

  if (isDefault) {
    const { error } = await clearDefault(supabase, orgId)
    if (error) return { ok: false, error: "Účet sa nepodarilo uložiť." }
  }

  const { error } = await supabase
    .from("bank_accounts")
    .update({ ...toRow(parsed.data), is_default: isDefault })
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Účet sa nepodarilo uložiť." }

  if (!isDefault && demoting) {
    await promoteAnotherDefault(supabase, orgId, id)
  }

  revalidatePath("/app/settings")
  return { ok: true, id }
}

export async function setDefaultBankAccount(
  id: string,
): Promise<BankAccountActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const role = await requireManagerRole(supabase, orgId)
  if (!role.ok) return { ok: false, error: role.error }

  const { data: current } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!current) return { ok: false, error: "Účet sa nenašiel." }

  const { error: clearError } = await clearDefault(supabase, orgId)
  if (clearError) {
    return { ok: false, error: "Predvolený účet sa nepodarilo nastaviť." }
  }

  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_default: true })
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) {
    return { ok: false, error: "Predvolený účet sa nepodarilo nastaviť." }
  }

  revalidatePath("/app/settings")
  return { ok: true, id }
}

export async function deleteBankAccount(
  id: string,
): Promise<BankAccountActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const role = await requireManagerRole(supabase, orgId)
  if (!role.ok) return { ok: false, error: role.error }

  const { data: current } = await supabase
    .from("bank_accounts")
    .select("id, is_default")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!current) return { ok: false, error: "Účet sa nenašiel." }

  const { error } = await supabase
    .from("bank_accounts")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Účet sa nepodarilo zmazať." }

  if (current.is_default) {
    await promoteAnotherDefault(supabase, orgId, id)
  }

  revalidatePath("/app/settings")
  return { ok: true, id }
}
