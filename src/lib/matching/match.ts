import { round2 } from "@/lib/money"

/**
 * Pure payment-matching logic. Matches an incoming bank transaction to an open
 * document by variable symbol (VS = invoice number) first, then by amount.
 * Returns the chosen document id and a confidence label. Deterministic +
 * unit-tested; the action layer applies the result.
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

function outstanding(d: MatchableDoc): number {
  return round2(d.total - d.paidAmount)
}

export function matchTransaction(
  tx: { amount: number; vs: string | null },
  docs: MatchableDoc[],
): MatchResult {
  // Only incoming payments settle receivables.
  if (tx.amount <= 0) return { documentId: null, confidence: "none" }

  const vs = digits(tx.vs)
  const amount = round2(tx.amount)

  // 1) Variable symbol matches the invoice number.
  if (vs) {
    const byVs = docs.filter((d) => digits(d.number) === vs)
    if (byVs.length === 1) {
      const exact = outstanding(byVs[0]) === amount
      return { documentId: byVs[0].id, confidence: exact ? "vs_amount" : "vs" }
    }
    if (byVs.length > 1) {
      // Disambiguate by amount.
      const exact = byVs.find((d) => outstanding(d) === amount)
      if (exact) return { documentId: exact.id, confidence: "vs_amount" }
      return { documentId: byVs[0].id, confidence: "vs" }
    }
  }

  // 2) No VS hit — fall back to a unique outstanding amount.
  const byAmount = docs.filter((d) => outstanding(d) === amount)
  if (byAmount.length === 1) {
    return { documentId: byAmount[0].id, confidence: "amount" }
  }

  return { documentId: null, confidence: "none" }
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
