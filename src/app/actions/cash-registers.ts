"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
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
  revalidatePath(PATH)
  return { ok: true, id: data.id }
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

  const { data, error } = await supabase
    .from("cash_register_items")
    .insert({
      organization_id: orgId,
      cash_register_id: v.cashRegisterId,
      direction: v.direction,
      number: v.number ?? null,
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
