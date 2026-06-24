/**
 * Cash-flow forecast (§7.5). PURE, deterministic computation — no DB, no AI, no
 * `new Date()`. The caller passes a fixed `today` so projections and tests are
 * reproducible. Money is rounded with `round2` at every boundary.
 */

import { round2 } from "@/lib/money"

/** A receivable that still owes money (status issued/sent/partially_paid/overdue). */
export interface ForecastInvoice {
  contactId: string | null
  total: number
  paidAmount: number
  /** ISO date (YYYY-MM-DD) the invoice is expected to be paid by. */
  dueDate: string | null
}

/** A historical paid invoice, used to learn per-customer payment behaviour. */
export interface PaidInvoiceSample {
  contactId: string | null
  dueDate: string | null
  /** ISO date/timestamp the payment actually landed. */
  paidAt: string | null
}

/** An active recurring invoice scheduled to issue within the horizon. */
export interface ForecastRecurring {
  contactId: string | null
  /** ISO date the next invoice will be generated. */
  nextRunAt: string | null
  /** Estimated amount of the generated invoice; skipped when null/0. */
  amount: number | null
}

export interface ForecastContact {
  id: string
  name: string
}

export interface ComputeForecastInput {
  invoices: ForecastInvoice[]
  paidSamples: PaidInvoiceSample[]
  recurring: ForecastRecurring[]
  contacts: ForecastContact[]
}

/** Per-customer payment-behaviour summary derived from history. */
export interface BehaviourSummary {
  contactId: string
  name: string
  /** Median (paidAt − dueDate) in days; positive = pays late. 0 if unknown. */
  offsetDays: number
  /** Number of paid invoices the offset was learned from. */
  sampleCount: number
}

export interface ForecastBuckets {
  day30: number
  day60: number
  day90: number
}

export interface ForecastResult {
  buckets: ForecastBuckets
  /** Total outstanding across all open receivables. */
  totalReceivables: number
  /** Outstanding on invoices already past due (by raw due date) as of `today`. */
  overdueTotal: number
  behaviour: BehaviourSummary[]
}

const MS_PER_DAY = 86_400_000

/** Parse an ISO date (date or timestamp) to a UTC-midnight Date, or null. */
function parseDate(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Whole-day difference a − b (floored), so timestamps don't add partial days. */
function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY)
}

/** Median of a numeric list (rounded to whole days). Empty → 0. */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  const m =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return Math.round(m)
}

/**
 * Median number of days a customer pays after the due date, learned from their
 * paid invoices. Positive = habitually late; 0 when no usable history.
 */
export function paymentBehaviourOffset(
  samples: PaidInvoiceSample[],
  contactId: string,
): number {
  const deltas: number[] = []
  for (const s of samples) {
    if (s.contactId !== contactId) continue
    const due = parseDate(s.dueDate)
    const paid = parseDate(s.paidAt)
    if (!due || !paid) continue
    deltas.push(diffDays(paid, due))
  }
  return median(deltas)
}

/**
 * Build a rolling 30/60/90-day cash-inflow projection from open receivables and
 * upcoming recurring invoices, adjusting each receivable's expected pay date by
 * the customer's learned payment-behaviour offset.
 */
export function computeForecast(
  input: ComputeForecastInput,
  today: Date,
): ForecastResult {
  const horizon90 = new Date(today.getTime() + 90 * MS_PER_DAY)

  // Per-customer offsets, computed once and reused for both buckets + summary.
  const offsetCache = new Map<string, number>()
  const offsetFor = (contactId: string | null): number => {
    if (!contactId) return 0
    let v = offsetCache.get(contactId)
    if (v === undefined) {
      v = paymentBehaviourOffset(input.paidSamples, contactId)
      offsetCache.set(contactId, v)
    }
    return v
  }

  let day30 = 0
  let day60 = 0
  let day90 = 0
  let totalReceivables = 0
  let overdueTotal = 0

  const addToBuckets = (amount: number, expected: Date) => {
    const days = diffDays(expected, today)
    // Already-due / past inflow counts toward the nearest (30) bucket.
    if (days > 90) return
    if (days <= 30) day30 = round2(day30 + amount)
    if (days <= 60) day60 = round2(day60 + amount)
    if (days <= 90) day90 = round2(day90 + amount)
  }

  for (const inv of input.invoices) {
    const outstanding = round2(inv.total - inv.paidAmount)
    if (outstanding <= 0) continue
    totalReceivables = round2(totalReceivables + outstanding)

    const due = parseDate(inv.dueDate)
    if (due && diffDays(due, today) < 0) {
      overdueTotal = round2(overdueTotal + outstanding)
    }

    if (!due) continue
    const expected = new Date(
      due.getTime() + offsetFor(inv.contactId) * MS_PER_DAY,
    )
    addToBuckets(outstanding, expected)
  }

  for (const rec of input.recurring) {
    const amount = rec.amount
    if (!amount || amount <= 0) continue
    const runAt = parseDate(rec.nextRunAt)
    if (!runAt) continue
    if (
      runAt.getTime() < today.getTime() ||
      runAt.getTime() > horizon90.getTime()
    )
      continue
    addToBuckets(round2(amount), runAt)
  }

  const contactName = new Map(input.contacts.map((c) => [c.id, c.name]))
  const behaviour: BehaviourSummary[] = []
  for (const [contactId, offsetDays] of offsetCache) {
    const sampleCount = input.paidSamples.filter(
      (s) => s.contactId === contactId && s.dueDate && s.paidAt,
    ).length
    behaviour.push({
      contactId,
      name: contactName.get(contactId) ?? contactId,
      offsetDays,
      sampleCount,
    })
  }

  return {
    buckets: { day30, day60, day90 },
    totalReceivables,
    overdueTotal,
    behaviour,
  }
}
