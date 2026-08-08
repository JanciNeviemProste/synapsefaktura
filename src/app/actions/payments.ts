"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { formatMoney, round2 } from "@/lib/money"
import {
  parseBankCsv,
  transactionKey,
  isDuplicateTransaction,
  shouldAutoBook,
} from "@/lib/bank/csv-import"
import {
  matchTransaction,
  matchExpenseTransaction,
  type MatchableDoc,
  type MatchableExpense,
} from "@/lib/matching/match"
import { documentPresentation } from "@/lib/documents/presentation"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import { recordExpensePayment } from "@/app/actions/expenses"

type PaymentMethod = "bank" | "card" | "cash" | "other"

/**
 * Typy dokladov, ktore su vyzvou na uhradu. Cenova ponuka ani dodaci list nou
 * nie su, takze nesmu pohltit prichodziu platbu. Zoznam sa odvodzuje z
 * prezentacnych pravidiel (`isPayable`), aby sa nerozisiel s tym, co doklad
 * realne tvrdi navonok.
 */
const PAYABLE_DOCUMENT_TYPES = (
  Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]
).filter((t) => documentPresentation(t).isPayable)

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
    /** Mena, v ktorej uhrada realne prisla (z bankoveho vypisu). */
    currency?: string | null
    /** VS tak, ako realne prisiel — moze sa lisit od VS dokladu. */
    variableSymbol?: string | null
    /** Uz zistena organizacia (bankovy import); inak si ju akcia zisti sama. */
    orgId?: string | null
  } = {},
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const orgId = opts.orgId ?? (await getCurrentOrgId(supabase))
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: doc } = await supabase
    .from("documents")
    .select("total, paid_amount, currency, exchange_rate")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!doc) return { ok: false, error: "Doklad sa nenašiel." }

  // Mena uhrady = co realne prislo z banky, inak mena dokladu.
  const currency = (opts.currency || doc.currency).toUpperCase()
  // Kurz NEHADAME. Ked uhrada prisla v mene dokladu, plati kurz dokladu; pri
  // inej mene zapiseme 1 — dopocet skutocneho kurzu dna uhrady je samostatna
  // praca a tichy odhad by bol horsi nez ziadny. `amount_home` dopocita
  // trigger `payments_fill_amount_home`.
  const exchangeRate =
    currency === doc.currency.toUpperCase() ? doc.exchange_rate : 1

  const { error: payErr } = await supabase.from("payments").insert({
    document_id: documentId,
    amount: round2(amount),
    paid_at: opts.paidAt || undefined,
    method: opts.method ?? "bank",
    bank_transaction_id: opts.bankTransactionId ?? null,
    currency,
    exchange_rate: exchangeRate,
    variable_symbol: opts.variableSymbol ?? null,
  })
  if (payErr) return { ok: false, error: "Platbu sa nepodarilo uložiť." }

  const newPaid = round2(doc.paid_amount + amount)
  // A payment only ever moves a document to partially_paid or paid.
  const status = newPaid >= round2(doc.total) ? "paid" : "partially_paid"
  const { error } = await supabase
    .from("documents")
    .update({ paid_amount: newPaid, status })
    .eq("id", documentId)
    .eq("organization_id", orgId)
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
  /** Preskocene duplicity (rovnaky datum, suma, VS a protistrana). */
  skipped: number
  errors: string[]
}

/**
 * Imports a bank-statement CSV: stores each transaction, auto-matches incoming
 * payments to open payable documents and outgoing payments to open expenses
 * (VS, then amount), and records payments only when the amount matches
 * exactly. Already imported transactions are skipped.
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
      skipped: 0,
      errors: ["Chýba firma."],
    }
  }

  const { transactions, errors } = parseBankCsv(content)

  const { data: openDocs } = await supabase
    .from("documents")
    .select("id, number, variable_symbol, total, paid_amount")
    .eq("organization_id", orgId)
    .in("type", PAYABLE_DOCUMENT_TYPES)
    .in("status", ["issued", "sent", "partially_paid", "overdue"])

  const candidates: MatchableDoc[] = (openDocs ?? []).map((d) => ({
    id: d.id,
    number: d.number,
    variableSymbol: d.variable_symbol,
    total: d.total,
    paidAmount: d.paid_amount,
  }))

  // Odchodzie platby sa paruju s neuhradenymi nakladmi (zavazkami).
  const { data: openExpenses } = await supabase
    .from("expenses")
    .select("id, document_number, total, paid_amount")
    .eq("organization_id", orgId)
    .in("status", ["unpaid", "partially_paid"])

  const expenseCandidates: MatchableExpense[] = (openExpenses ?? []).map(
    (e) => ({
      id: e.id,
      documentNumber: e.document_number,
      total: e.total,
      paidAmount: e.paid_amount,
    }),
  )

  // Kluce uz ulozenych pohybov — proti nim overujeme duplicity.
  const { data: existingRows } = await supabase
    .from("bank_transactions")
    .select("booked_at, amount, vs, counterparty")
    .eq("organization_id", orgId)

  const seen = new Set(
    (existingRows ?? []).map((r) =>
      transactionKey({
        bookedAt: r.booked_at,
        amount: r.amount,
        vs: r.vs,
        counterparty: r.counterparty,
      }),
    ),
  )

  let imported = 0
  let matched = 0
  let unmatched = 0
  let skipped = 0

  for (const tx of transactions) {
    const identity = {
      bookedAt: tx.bookedAt,
      amount: tx.amount,
      vs: tx.vs,
      counterparty: tx.counterparty,
    }
    if (isDuplicateTransaction(identity, seen)) {
      skipped++
      continue
    }
    seen.add(transactionKey(identity))

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

    let booked = false

    if (tx.amount > 0) {
      const m = matchTransaction({ amount: tx.amount, vs: tx.vs }, candidates)
      // Knihujeme len presnu zhodu sumy; zhoda len cez VS ostava nesparovana.
      if (m.documentId && shouldAutoBook(m)) {
        const res = await recordPayment(m.documentId, tx.amount, {
          paidAt: tx.bookedAt,
          method: "bank",
          bankTransactionId: txRow?.id ?? null,
          // Mena a VS su to, co realne prislo z banky — nie to, co ocakava
          // doklad; pri rieseni nezrovnalosti treba vediet oboje.
          currency: tx.currency,
          variableSymbol: tx.vs,
          orgId,
        })
        // Bez tejto kontroly by sa transakcia oznacila ako `matched`, hoci
        // platba v databaze nie je — a pri opatovnom importe by ju dedup
        // preskocil, takze by sa uz nikdy nezaknihovala.
        if (res.ok) {
          // Keep local candidates in sync so we don't double-match the same doc.
          const c = candidates.find((x) => x.id === m.documentId)
          if (c) c.paidAmount = round2(c.paidAmount + tx.amount)
          booked = true
        } else {
          console.error("[bank] zapis uhrady zlyhal", m.documentId, res.error)
          errors.push(
            `Platba ${formatMoney(tx.amount, tx.currency)} sa nepodarila zaknihovať: ${res.error}`,
          )
        }
      }
    } else if (tx.amount < 0) {
      const m = matchExpenseTransaction(
        { amount: tx.amount, vs: tx.vs },
        expenseCandidates,
      )
      // PRISNEJSIE NEZ PRI FAKTURACH, a zamerne.
      //
      // Na kredite vypisu su takmer vylucne platby od odberatelov, takze zhoda
      // samotnej sumy je tam obhajitelna. Na debete su aj mzdy, odvody, DPH,
      // najom, poplatky banky a prevody na vlastny ucet — staci, aby ktorakolvek
      // z nich mala sumu presne rovnu zostatku jedneho otvoreneho nakladu, a
      // faktura dodavatela by sa ticho oznacila za uhradenu. Pri mesacnych
      // pausaloch (12,00 / 29,90) je taka zhoda skoro ista.
      //
      // Vyzadujeme preto zhodu VS AJ sumy; samotna zhoda sumy ostava na rucne
      // potvrdenie.
      if (m.expenseId && m.confidence === "vs_amount") {
        const paid = round2(-tx.amount)
        const res = await recordExpensePayment({
          expenseId: m.expenseId,
          amount: paid,
          paidAt: tx.bookedAt ?? "",
          method: "bank",
          // Vazba na pohyb je klucom idempotencie: pri opatovnom importe toho
          // isteho vypisu sa tato uhrada uz nezauctuje druhy raz.
          bankTransactionId: txRow?.id ?? null,
        })
        if (res.ok) {
          const c = expenseCandidates.find((x) => x.id === m.expenseId)
          if (c) c.paidAmount = round2(c.paidAmount + paid)
          booked = true
        } else {
          console.error(
            "[bank] zapis uhrady nakladu zlyhal",
            m.expenseId,
            res.error,
          )
          errors.push(
            `Úhradu nákladu ${formatMoney(paid, tx.currency)} sa nepodarilo zapísať: ${res.error}`,
          )
        }
      }
    }

    if (booked) {
      if (txRow) {
        await supabase
          .from("bank_transactions")
          .update({ matched_status: "matched" })
          .eq("id", txRow.id)
      }
      matched++
    } else {
      unmatched++
    }
  }

  revalidatePath("/app/invoices")
  revalidatePath("/app/expenses")
  revalidatePath("/app/bank")
  return { ok: true, imported, matched, unmatched, skipped, errors }
}
