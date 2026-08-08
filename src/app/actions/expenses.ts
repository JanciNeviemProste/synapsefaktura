"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeOutcome } from "@/lib/supabase/affected"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { expenseSchema, type ExpenseInput } from "@/lib/validation/expense"
import {
  expensePaymentSchema,
  type ExpensePaymentInput,
} from "@/lib/validation/expense-payment"
import { addExpensePayment, expensePaymentStatus } from "@/lib/expenses/payment"
import { computeExpenseItems } from "@/lib/expenses/items"
import { round2 } from "@/lib/money"
import type { Database } from "@/lib/supabase/database.types"

export type ExpenseActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export type ExpenseItemRow =
  Database["public"]["Tables"]["expense_items"]["Row"]

export type ExpensePaymentRow =
  Database["public"]["Tables"]["expense_payments"]["Row"]

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

/**
 * Sumy nakladu. Ked pridu polozky, prepocitaju sa z NICH a `subtotal`/`vatRate`
 * od volajuceho sa zahodia — inak by doklad tvrdil jedno a jeho rozpis druhe.
 * Bez poloziek ostava povodne spravanie s jednou sumou a jednou sadzbou
 * (AI OCR z blocku, prijata e-faktura).
 */
function computeAmounts(v: ReturnType<typeof expenseSchema.parse>) {
  if (!v.items || v.items.length === 0) {
    return { amounts: compute(v.subtotal, v.vatRate), items: null }
  }
  const r = computeExpenseItems(v.items)
  return {
    amounts: {
      subtotal: r.subtotal,
      vat_total: r.vat_total,
      total: r.total,
      vat_rate_breakdown: r.vat_rate_breakdown,
    },
    items: r.items,
  }
}

function toRow(v: ReturnType<typeof expenseSchema.parse>) {
  const { amounts } = computeAmounts(v)
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

  const written = await replaceExpenseItems(supabase, data.id, parsed.data)
  if (!written.ok) return written

  revalidatePath("/app/expenses")
  return { ok: true, id: data.id }
}

/**
 * Prepise polozky nakladu na presne to, co prislo vo vstupe.
 *
 * Bez poloziek sa existujuce ZMAZU: naklad s jednou sumou nesmie niest rozpis
 * z predchadzajucej verzie, inak by hlavicka tvrdila jedno a polozky druhe.
 *
 * `expense_items` nema vlastny `organization_id` — RLS ide cez `expense_id`,
 * a volajuci uz overil, ze naklad patri jeho firme.
 */
async function replaceExpenseItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
  v: ReturnType<typeof expenseSchema.parse>,
): Promise<ExpenseActionResult> {
  const { items } = computeAmounts(v)

  const { error: deleteError } = await supabase
    .from("expense_items")
    .delete()
    .eq("expense_id", expenseId)
  if (deleteError) {
    return { ok: false, error: "Položky nákladu sa nepodarilo uložiť." }
  }

  if (!items || items.length === 0) return { ok: true, id: expenseId }

  const { error } = await supabase
    .from("expense_items")
    .insert(items.map((i) => ({ ...i, expense_id: expenseId })))
  if (error) {
    return { ok: false, error: "Položky nákladu sa nepodarilo uložiť." }
  }
  return { ok: true, id: expenseId }
}

/**
 * Polozky pre CELY zoznam nakladov naraz — kluc je id nakladu.
 *
 * Nacitat rozpis pre kazdy riadok zvlast by pri stovke nakladov znamenalo
 * stovku dotazov. Tu ide jeden dotaz na `expenses` (kvoli prislusnosti k firme)
 * a jeden na `expense_items`.
 */
export async function expenseItemsByExpense(
  ids: string[],
): Promise<Record<string, ExpenseItemRow[]>> {
  if (ids.length === 0) return {}

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return {}

  // `expense_items` nema `organization_id`, takze prislusnost k firme sa overi
  // cez samotny naklad — inak by sa dal precitat rozpis cudzieho dokladu.
  const { data: own } = await supabase
    .from("expenses")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", ids)
  const allowed = new Set((own ?? []).map((e) => e.id))
  if (allowed.size === 0) return {}

  const { data } = await supabase
    .from("expense_items")
    .select("*")
    .in("expense_id", [...allowed])
    .order("position")

  const map: Record<string, ExpenseItemRow[]> = {}
  for (const row of data ?? []) {
    ;(map[row.expense_id] ??= []).push(row)
  }
  return map
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
  // `.select("id")` nie je kozmetika: PostgREST pri zapise odfiltrovanom RLS
  // nevrati chybu, len nezmeni ziadny riadok. Bez toho by sa polozky prepisali
  // na naklade, ktoreho hlavicka sa neupravila.
  const { data, error } = await supabase
    .from("expenses")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
  if (error) return { ok: false, error: "Náklad sa nepodarilo uložiť." }
  if (!data || data.length === 0) {
    return { ok: false, error: "Náklad sa nenašiel." }
  }

  const written = await replaceExpenseItems(supabase, id, parsed.data)
  if (!written.ok) return written

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
    .select("total")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!expense) return { ok: false, error: "Náklad sa nenašiel." }

  const { paidAt, method, note, bankTransactionId } = parsed.data

  // Idempotencia proti opakovanemu importu vypisu: ten isty bankovy pohyb sa
  // na ten isty naklad nezauctuje dvakrat. Kontrola je tu kvoli citatelnej
  // hlaske, zaruku dava unikatny index v DB (subezne behy).
  if (bankTransactionId) {
    const { data: already } = await supabase
      .from("expense_payments")
      .select("id")
      .eq("expense_id", expenseId)
      .eq("bank_transaction_id", bankTransactionId)
      .maybeSingle()
    if (already) {
      // Uz zauctovane nie je chyba — vysledok je presne ten, ktory volajuci chcel.
      return { ok: true, id: expenseId }
    }
  }

  const { error: insertError } = await supabase
    .from("expense_payments")
    .insert({
      expense_id: expenseId,
      amount,
      paid_at: paidAt || new Date().toISOString().slice(0, 10),
      method,
      note: note || null,
      bank_transaction_id: bankTransactionId ?? null,
    })
  if (insertError) {
    return { ok: false, error: "Úhradu sa nepodarilo uložiť." }
  }

  const synced = await syncExpensePaidAmount(supabase, expenseId, expense.total)
  if (!synced) return { ok: false, error: "Úhradu sa nepodarilo uložiť." }

  revalidatePath("/app/expenses")
  // Cash-flow v prehladoch cita `paid_amount`, takze sa musi prepocitat tiez.
  revalidatePath("/app/reports")
  return { ok: true, id: expenseId }
}

/**
 * Prepocita `expenses.paid_amount` a `status` zo SUCTU zaevidovanych uhrad.
 *
 * Toto je jadro opravy: `paid_amount` uz nie je nezavisle vedene cislo, ktore
 * sa inkrementuje pri kazdom kliku, ale odvodena hodnota. Dvojklik ani
 * opakovany import ho preto nemozu nafuknut — su to bud dva riadky, alebo
 * ziadny novy, a sucet je vzdy pravda.
 */
async function syncExpensePaidAmount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
  total: number,
): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from("expense_payments")
    .select("amount")
    .eq("expense_id", expenseId)
  if (error) return false

  const paidAmount = (rows ?? []).reduce(
    (sum, r) => addExpensePayment(sum, r.amount),
    0,
  )

  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      paid_amount: paidAmount,
      status: expensePaymentStatus(paidAmount, total),
    })
    .eq("id", expenseId)
  return !updateError
}

/** Zaevidovane uhrady nakladu, od najnovsej. */
export async function listExpensePayments(expenseId: string) {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  // `expense_payments` nema `organization_id`, takze prislusnost k firme sa
  // overi cez samotny naklad — inak by sa dali precitat cudzie uhrady.
  const { data: expense } = await supabase
    .from("expenses")
    .select("id")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!expense) return []

  const { data } = await supabase
    .from("expense_payments")
    .select("*")
    .eq("expense_id", expenseId)
    .order("paid_at", { ascending: false })
  return data ?? []
}

/**
 * Uhrady pre CELY zoznam nakladov naraz — kluc je id nakladu.
 *
 * Rovnaky dovod ako pri polozkach: nacitavat ich po jednom by pri stovke
 * nakladov znamenalo stovku dotazov.
 */
export async function expensePaymentsByExpense(
  ids: string[],
): Promise<Record<string, ExpensePaymentRow[]>> {
  if (ids.length === 0) return {}

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return {}

  const { data: own } = await supabase
    .from("expenses")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", ids)
  const allowed = new Set((own ?? []).map((e) => e.id))
  if (allowed.size === 0) return {}

  const { data } = await supabase
    .from("expense_payments")
    .select("*")
    .in("expense_id", [...allowed])
    .order("paid_at", { ascending: false })

  const map: Record<string, ExpensePaymentRow[]> = {}
  for (const row of data ?? []) {
    ;(map[row.expense_id] ??= []).push(row)
  }
  return map
}

/** Zmaze JEDNU uhradu a prepocita naklad. */
export async function deleteExpensePayment(
  paymentId: string,
): Promise<ExpenseActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: payment } = await supabase
    .from("expense_payments")
    .select("id, expense_id, expenses!inner(id, total, organization_id)")
    .eq("id", paymentId)
    .maybeSingle()
  const expense = payment?.expenses as unknown as
    | { id: string; total: number; organization_id: string }
    | undefined
  if (!payment || !expense || expense.organization_id !== orgId) {
    return { ok: false, error: "Úhrada sa nenašla." }
  }

  const { data, error } = await supabase
    .from("expense_payments")
    .delete()
    .eq("id", paymentId)
    .select("id")
  const outcome = writeOutcome(error, data)
  if (outcome.kind !== "ok") {
    return { ok: false, error: "Úhradu sa nepodarilo zrušiť." }
  }

  await syncExpensePaidAmount(supabase, payment.expense_id, expense.total)

  revalidatePath("/app/expenses")
  revalidatePath("/app/reports")
  return { ok: true, id: payment.expense_id }
}

/**
 * Zrusi VSETKY zaevidovane uhrady nakladu (oprava omylu).
 *
 * Mazu sa aj riadky z bankoveho importu. To je zamer — inak by po zruseni
 * ostali "duchy", ktore uz nikto nevidi, ale ktore by zabranili opatovnemu
 * zauctovaniu tej istej platby.
 */
export async function clearExpensePayments(
  id: string,
): Promise<ExpenseActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: expense } = await supabase
    .from("expenses")
    .select("id, total")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!expense) return { ok: false, error: "Náklad sa nenašiel." }

  const { error } = await supabase
    .from("expense_payments")
    .delete()
    .eq("expense_id", id)
  if (error) return { ok: false, error: "Úhradu sa nepodarilo zrušiť." }

  const synced = await syncExpensePaidAmount(supabase, id, expense.total)
  if (!synced) return { ok: false, error: "Úhradu sa nepodarilo zrušiť." }

  revalidatePath("/app/expenses")
  revalidatePath("/app/reports")
  return { ok: true, id }
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
