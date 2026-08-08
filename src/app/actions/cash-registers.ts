"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeOutcome } from "@/lib/supabase/affected"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  cashRegisterSchema,
  cashItemSchema,
  type CashRegisterInput,
  type CashItemInput,
} from "@/lib/validation/cash-register"

export type CashActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

const PATH = "/app/cash"

function registerRow(v: ReturnType<typeof cashRegisterSchema.parse>) {
  return {
    name: v.name,
    description: v.description ?? null,
    currency: v.currency,
    active: v.active,
  }
}

/**
 * Overi, ze cudzi kluc patri tej istej organizacii. Samotna RLS nestaci —
 * pusti vsetky organizacie, ktorych je pouzivatel clenom, takze bez tejto
 * kontroly by sa dal doklad naviazat na pokladnu/kontakt inej firmy.
 */
async function belongsToOrg(
  supabase: SupabaseClient<Database>,
  table: "cash_registers" | "contacts" | "documents" | "expenses",
  id: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  return !!data
}

export async function createCashRegister(
  input: CashRegisterInput,
): Promise<CashActionResult> {
  const parsed = cashRegisterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("cash_registers")
    .insert({ organization_id: orgId, ...registerRow(parsed.data) })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Pokladňu sa nepodarilo uložiť." }

  await ensureCashSequences(supabase, orgId, data.id)

  revalidatePath(PATH)
  return { ok: true, id: data.id }
}

/**
 * Zalozi pokladni prijmovy a vydavkovy ciselny rad, ak ich este nema, a
 * naviaze ich cez `sequence_in_id` / `sequence_out_id`.
 *
 * Vola sa aj pri zapise dokladu, nielen pri vzniku pokladne: pokladne
 * zalozene pred touto migraciou rady nemaju a bez doplnenia by ich doklady
 * ostali bez cisla.
 *
 * Zlyhanie sa NEHLASI ako chyba akcie — pokladna je vytvorena a doklad sa da
 * ocislovat rucne. Tichy nesulad je horsi nez chybajuce cislo, tak sa aspon
 * zaloguje.
 */
async function ensureCashSequences(
  supabase: SupabaseClient<Database>,
  orgId: string,
  registerId: string,
): Promise<{ inId: string | null; outId: string | null }> {
  const { data: register } = await supabase
    .from("cash_registers")
    .select("sequence_in_id, sequence_out_id")
    .eq("id", registerId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!register) return { inId: null, outId: null }

  const year = new Date().getFullYear()
  const wanted: { kind: "cash_in" | "cash_out"; prefix: string }[] = [
    // PPD = prijmovy pokladnicny doklad, VPD = vydavkovy. Bezne skratky, aby
    // bolo z cisla vidiet, o ktory rad ide.
    { kind: "cash_in", prefix: "PPD" },
    { kind: "cash_out", prefix: "VPD" },
  ]

  const result: { inId: string | null; outId: string | null } = {
    inId: register.sequence_in_id,
    outId: register.sequence_out_id,
  }

  for (const w of wanted) {
    const existing = w.kind === "cash_in" ? result.inId : result.outId
    if (existing) continue

    const { data: seq, error } = await supabase
      .from("number_sequences")
      .insert({
        organization_id: orgId,
        kind: w.kind,
        cash_register_id: registerId,
        doc_type: null,
        year,
        prefix: w.prefix,
        format: "{prefix}{year}{seq}",
        padding: 4,
      })
      .select("id")
      .single()
    if (error || !seq) {
      console.error("[cash] ciselny rad sa nepodarilo zalozit", {
        registerId,
        kind: w.kind,
        error: error?.message,
      })
      continue
    }
    if (w.kind === "cash_in") result.inId = seq.id
    else result.outId = seq.id
  }

  if (
    result.inId !== register.sequence_in_id ||
    result.outId !== register.sequence_out_id
  ) {
    await supabase
      .from("cash_registers")
      .update({ sequence_in_id: result.inId, sequence_out_id: result.outId })
      .eq("id", registerId)
      .eq("organization_id", orgId)
  }

  return result
}

export async function updateCashRegister(
  id: string,
  input: CashRegisterInput,
): Promise<CashActionResult> {
  const parsed = cashRegisterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("cash_registers")
    .update(registerRow(parsed.data))
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")

  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Pokladňu sa nepodarilo uložiť." }
  }
  if (outcome.kind === "noRows") {
    return { ok: false, error: "Pokladňa sa nenašla." }
  }
  revalidatePath(PATH)
  return { ok: true, id }
}

/** Zmaze pokladnu aj s dokladmi (FK ma `on delete cascade`). */
export async function deleteCashRegister(
  id: string,
): Promise<CashActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // `.select("id")` je nutne: politika `cash_registers_delete_admin` pusti len
  // owner/admin, ale PostgREST pri odfiltrovanom riadku vrati 204 bez chyby.
  // Bez tohto by clen bez opravnenia dostal „Pokladna zmazana“ a pokladna by
  // ostala.
  const { data, error } = await supabase
    .from("cash_registers")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")

  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Pokladňu sa nepodarilo zmazať." }
  }
  if (outcome.kind === "noRows") {
    // Riadok je cez SELECT vidno, ale DELETE ho nezasiahol → chyba opravnenie.
    // `select` pusti kazdeho clena, `delete` len owner/admin, takze rozlisenie
    // je zmysluplne a pouzivatel sa dozvie, co ma robit.
    const { data: visible } = await supabase
      .from("cash_registers")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return {
      ok: false,
      error: visible
        ? "Pokladňu môže zmazať len majiteľ alebo správca firmy."
        : "Pokladňa sa nenašla.",
    }
  }
  revalidatePath(PATH)
  return { ok: true, id }
}

export async function createCashItem(
  input: CashItemInput,
): Promise<CashActionResult> {
  const parsed = cashItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const registerOk = await belongsToOrg(
    supabase,
    "cash_registers",
    v.cashRegisterId,
    orgId,
  )
  if (!registerOk) return { ok: false, error: "Pokladňa sa nenašla." }

  if (v.contactId) {
    const ok = await belongsToOrg(supabase, "contacts", v.contactId, orgId)
    if (!ok) return { ok: false, error: "Kontakt sa nenašiel." }
  }
  if (v.documentId) {
    const ok = await belongsToOrg(supabase, "documents", v.documentId, orgId)
    if (!ok) return { ok: false, error: "Doklad sa nenašiel." }
  }
  if (v.expenseId) {
    const ok = await belongsToOrg(supabase, "expenses", v.expenseId, orgId)
    if (!ok) return { ok: false, error: "Náklad sa nenašiel." }
  }

  // Cislo z ciselneho radu, ked ho pouzivatel nezadal rucne. Pri pokladnicnej
  // knihe je suvisly rad zakonna poziadavka, takze volny text nestaci.
  //
  // RPC sa vola service-role klientom: `next_sequence_number` je `security
  // definer` a pravo na priame volanie cez PostgREST je odobrate, aby si nikto
  // nemohol minat cisla z cudzieho radu. Prislusnost k firme uz overil
  // `belongsToOrg` vyssie.
  let number = v.number ?? null
  if (!number) {
    const seq = await ensureCashSequences(supabase, orgId, v.cashRegisterId)
    const sequenceId = v.direction === "in" ? seq.inId : seq.outId
    if (sequenceId) {
      const year = Number(v.issuedOn.slice(0, 4)) || new Date().getFullYear()
      const { data: allocated, error: seqError } =
        await createAdminClient().rpc("next_sequence_number", {
          p_sequence_id: sequenceId,
          p_year: year,
        })
      if (seqError) {
        console.error("[cash] cislo z radu sa nepodarilo pridelit", {
          registerId: v.cashRegisterId,
          direction: v.direction,
          error: seqError.message,
        })
      } else {
        number = allocated
      }
    }
  }

  const { data, error } = await supabase
    .from("cash_register_items")
    .insert({
      organization_id: orgId,
      cash_register_id: v.cashRegisterId,
      direction: v.direction,
      number,
      issued_on: v.issuedOn,
      amount: v.amount,
      vat_amount: v.vatAmount,
      description: v.description ?? null,
      contact_id: v.contactId ?? null,
      document_id: v.documentId ?? null,
      expense_id: v.expenseId ?? null,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Doklad sa nepodarilo uložiť." }
  revalidatePath(PATH)
  return { ok: true, id: data.id }
}

export async function deleteCashItem(id: string): Promise<CashActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("cash_register_items")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")

  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Doklad sa nepodarilo zmazať." }
  }
  if (outcome.kind === "noRows") {
    const { data: visible } = await supabase
      .from("cash_register_items")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return {
      ok: false,
      error: visible
        ? "Doklad môže zmazať len majiteľ alebo správca firmy."
        : "Doklad sa nenašiel.",
    }
  }
  revalidatePath(PATH)
  return { ok: true, id }
}
