/**
 * Uhrady nakladov — ciste odvodenie sumy a stavu (bez I/O).
 *
 * Tabulka `expenses` ma `paid_amount` + `status` (`public.payment_status`),
 * `reports/summary.ts` z nich rata `cashOut`. Ziadna cesta ich ale nezapisovala,
 * takze cash-flow v prehladoch bol trvalo nula. Logika zije tu, aby sa dala
 * testovat bez databazy.
 */

import { round2 } from "@/lib/money"

export type ExpensePaymentStatus = "unpaid" | "partially_paid" | "paid"

/**
 * Pripocita uhradu k doteraz uhradenej sume (uhrad moze byt viac, preto sa
 * pripocitava, neprepisuje). Vysledok neklesne pod nulu, aby oprava zapornou
 * sumou nevyrobila zaporny `paid_amount`.
 */
export function addExpensePayment(paidAmount: number, amount: number): number {
  const next = round2(paidAmount + amount)
  return next > 0 ? next : 0
}

/**
 * Stav uhrady z (uhradene, spolu): nic = `unpaid`, menej ako suma dokladu =
 * `partially_paid`, inak `paid`. Preplatok neodmietame — v praxi sa stava
 * (poplatky, zaokruhlenie) a stav je vtedy `paid`.
 */
export function expensePaymentStatus(
  paidAmount: number,
  total: number,
): ExpensePaymentStatus {
  const paid = round2(paidAmount)
  if (paid <= 0) return "unpaid"
  return paid >= round2(total) ? "paid" : "partially_paid"
}

/** Kolko ostava douhradit — preplatok ani zapor nedava zaporny zvysok. */
export function remainingToPay(paidAmount: number, total: number): number {
  const rest = round2(round2(total) - round2(paidAmount))
  return rest > 0 ? rest : 0
}
