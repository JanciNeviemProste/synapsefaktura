"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { round2 } from "@/lib/money"
import { parseBankCsv } from "@/lib/bank/csv-import"
import { matchTransaction, type MatchableDoc } from "@/lib/matching/match"

type PaymentMethod = "bank" | "card" | "cash" | "other"

/**
 * Records a payment against a document and recomputes its paid amount + status.
 * Used by manual mark-as-paid, partial payments, and bank matching.
 */
export async function recordPayment(
  documentId: string,
  amount: number,
  opts: {
    paidAt?: string | null
    method?: PaymentMethod
    bankTransactionId?: string | null
  } = {},
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("documents")
    .select("total, paid_amount")
    .eq("id", documentId)
    .maybeSingle()
  if (!doc) return { ok: false, error: "Doklad sa nenašiel." }

  const { error: payErr } = await supabase.from("payments").insert({
    document_id: documentId,
    amount: round2(amount),
    paid_at: opts.paidAt || undefined,
    method: opts.method ?? "bank",
    bank_transaction_id: opts.bankTransactionId ?? null,
  })
  if (payErr) return { ok: false, error: "Platbu sa nepodarilo uložiť." }

  const newPaid = round2(doc.paid_amount + amount)
  // A payment only ever moves a document to partially_paid or paid.
  const status = newPaid >= round2(doc.total) ? "paid" : "partially_paid"
  const { error } = await supabase
    .from("documents")
    .update({ paid_amount: newPaid, status })
    .eq("id", documentId)
  if (error) return { ok: false, error: "Stav dokladu sa nepodarilo upraviť." }

  revalidatePath("/app/invoices")
  revalidatePath(`/app/invoices/${documentId}`)
  return { ok: true }
}

export interface BankImportSummary {
  ok: boolean
  imported: number
  matched: number
  unmatched: number
  errors: string[]
}

/**
 * Imports a bank-statement CSV: stores each transaction, auto-matches incoming
 * payments to open documents (VS = number, then amount), and records payments
 * for confident matches.
 */
export async function importBankCsv(
  content: string,
): Promise<BankImportSummary> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return {
      ok: false,
      imported: 0,
      matched: 0,
      unmatched: 0,
      errors: ["Chýba firma."],
    }
  }

  const { transactions, errors } = parseBankCsv(content)

  const { data: openDocs } = await supabase
    .from("documents")
    .select("id, number, total, paid_amount")
    .in("status", ["issued", "sent", "partially_paid", "overdue"])

  const candidates: MatchableDoc[] = (openDocs ?? []).map((d) => ({
    id: d.id,
    number: d.number,
    total: d.total,
    paidAmount: d.paid_amount,
  }))

  let imported = 0
  let matched = 0
  let unmatched = 0

  for (const tx of transactions) {
    const { data: txRow } = await supabase
      .from("bank_transactions")
      .insert({
        organization_id: orgId,
        amount: tx.amount,
        currency: tx.currency,
        vs: tx.vs,
        ks: tx.ks,
        ss: tx.ss,
        counterparty: tx.counterparty,
        message: tx.message,
        booked_at: tx.bookedAt,
        raw: tx.raw,
        matched_status: "unmatched",
      })
      .select("id")
      .single()
    imported++

    const m = matchTransaction({ amount: tx.amount, vs: tx.vs }, candidates)
    if (
      m.documentId &&
      (m.confidence === "vs_amount" ||
        m.confidence === "amount" ||
        m.confidence === "vs")
    ) {
      await recordPayment(m.documentId, tx.amount, {
        paidAt: tx.bookedAt,
        method: "bank",
        bankTransactionId: txRow?.id ?? null,
      })
      if (txRow) {
        await supabase
          .from("bank_transactions")
          .update({ matched_status: "matched" })
          .eq("id", txRow.id)
      }
      // Keep local candidates in sync so we don't double-match the same doc.
      const c = candidates.find((x) => x.id === m.documentId)
      if (c) c.paidAmount = round2(c.paidAmount + tx.amount)
      matched++
    } else {
      unmatched++
    }
  }

  revalidatePath("/app/invoices")
  revalidatePath("/app/bank")
  return { ok: true, imported, matched, unmatched, errors }
}
