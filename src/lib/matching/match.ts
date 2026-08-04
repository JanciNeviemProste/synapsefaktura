import { round2 } from "@/lib/money"

/**
 * Pure payment-matching logic. Matches a bank transaction to an open record by
 * variable symbol (VS = invoice number) first, then by amount. Returns the
 * chosen id and a confidence label. Deterministic + unit-tested; the action
 * layer applies the result.
 *
 * Prichodzia platba (kladna suma) sa paruje s pohladavkami (`documents`),
 * odchodzia (zaporna suma) so zavazkami (`expenses`) — dve oddelene funkcie,
 * aby sa typy pohladavok a zavazkov nemiesali.
 */

export interface MatchableDoc {
  id: string
  number: string | null
  total: number
  paidAmount: number
}

export type MatchConfidence = "vs_amount" | "vs" | "amount" | "none"

export interface MatchResult {
  documentId: string | null
  confidence: MatchConfidence
}

function digits(s: string | null): string {
  return (s ?? "").replace(/\D/g, "")
}

/** Spolocny tvar parovania: cislo dokladu + zostatok. */
interface Candidate {
  id: string
  number: string | null
  total: number
  paidAmount: number
}

function outstanding(d: Candidate): number {
  return round2(d.total - d.paidAmount)
}

/**
 * Jadro parovania (VS, potom jednoznacna suma). `amount` je uz kladna suma
 * platby. Zdielaju ho pohladavky aj zavazky, aby sa pravidla nerozisli.
 */
function matchCandidates(
  vsRaw: string | null,
  amount: number,
  docs: Candidate[],
): { id: string | null; confidence: MatchConfidence } {
  const vs = digits(vsRaw)

  // 1) Variable symbol matches the invoice number.
  if (vs) {
    const byVs = docs.filter((d) => digits(d.number) === vs)
    if (byVs.length === 1) {
      const exact = outstanding(byVs[0]) === amount
      return { id: byVs[0].id, confidence: exact ? "vs_amount" : "vs" }
    }
    if (byVs.length > 1) {
      // Disambiguate by amount.
      const exact = byVs.find((d) => outstanding(d) === amount)
      if (exact) return { id: exact.id, confidence: "vs_amount" }
      return { id: byVs[0].id, confidence: "vs" }
    }
  }

  // 2) No VS hit — fall back to a unique outstanding amount.
  const byAmount = docs.filter((d) => outstanding(d) === amount)
  if (byAmount.length === 1) {
    return { id: byAmount[0].id, confidence: "amount" }
  }

  return { id: null, confidence: "none" }
}

export function matchTransaction(
  tx: { amount: number; vs: string | null },
  docs: MatchableDoc[],
): MatchResult {
  // Only incoming payments settle receivables.
  if (tx.amount <= 0) return { documentId: null, confidence: "none" }

  const r = matchCandidates(tx.vs, round2(tx.amount), docs)
  return { documentId: r.id, confidence: r.confidence }
}

/** Otvoreny naklad (zavazok) — `expenses.document_number` hra rolu VS. */
export interface MatchableExpense {
  id: string
  documentNumber: string | null
  total: number
  paidAmount: number
}

export interface ExpenseMatchResult {
  expenseId: string | null
  confidence: MatchConfidence
}

/**
 * Odchodzia platba (zaporna suma) proti nakladom. Naklad je uhradeny, ked sa
 * suma platby zhoduje so zostatkom (total - paid_amount); ak ma naklad
 * `document_number`, porovnava sa s VS rovnako ako cislo faktury.
 */
export function matchExpenseTransaction(
  tx: { amount: number; vs: string | null },
  expenses: MatchableExpense[],
): ExpenseMatchResult {
  // Only outgoing payments settle payables.
  if (tx.amount >= 0) return { expenseId: null, confidence: "none" }

  const r = matchCandidates(
    tx.vs,
    round2(-tx.amount),
    expenses.map((e) => ({
      id: e.id,
      number: e.documentNumber,
      total: e.total,
      paidAmount: e.paidAmount,
    })),
  )
  return { expenseId: r.id, confidence: r.confidence }
}

/** Recompute a payment status from total + the new paid amount. */
export function statusFromPaid(
  total: number,
  paidAmount: number,
): "unpaid" | "partially_paid" | "paid" {
  const paid = round2(paidAmount)
  if (paid <= 0) return "unpaid"
  if (paid >= round2(total)) return "paid"
  return "partially_paid"
}
