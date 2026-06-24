/**
 * Anomaly / duplicate detection (§7.7).
 *
 * Pure, deterministic heuristics — NO AI, NO I/O. The server action loads data
 * and hands it here; an optional friendly rationale can be layered on top
 * elsewhere with graceful degradation. Keep this module side-effect free so it
 * is trivially unit-testable.
 */

import { round2 } from "@/lib/money"

/** A single thing worth a human's attention. */
export type Anomaly = {
  kind: "duplicate" | "outlier" | "vat" | "missing"
  severity: "info" | "warning" | "danger"
  message: string
  entity: "invoice" | "expense"
  entityId: string
}

/** Minimal invoice shape consumed by the detector (subset of `documents`). */
export type InvoiceLike = {
  id: string
  number: string | null
  type: string
  total: number
  subtotal?: number | null
  vat_total?: number | null
  contact_id: string | null
  issue_date: string | null
  vat_mode?: string | null
  contact_name?: string | null
}

/** Minimal expense shape consumed by the detector (subset of `expenses`). */
export type ExpenseLike = {
  id: string
  document_number: string | null
  total: number
  supplier_contact_id: string | null
  issue_date: string | null
  vat_rate_breakdown?: unknown
  supplier_name?: string | null
}

export type DetectInput = {
  invoices: InvoiceLike[]
  expenses: ExpenseLike[]
}

/** VAT rates considered legitimate (SK + neighbouring/historical rates). */
const ALLOWED_VAT_RATES = new Set([23, 19, 5, 0, 20, 10])

/** Below this many samples per counterparty, statistics are meaningless. */
const MIN_SAMPLE = 4

/** Two invoice dates within this many days count as "near-same". */
const NEAR_DATE_DAYS = 3

// --- statistics helpers -----------------------------------------------------

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// --- small utilities --------------------------------------------------------

function daysBetween(a: string, b: string): number {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY
  return Math.abs(ta - tb) / 86_400_000
}

function counterparty(
  name: string | null | undefined,
  id: string | null,
): string {
  return name?.trim() || (id ? `partner ${id.slice(0, 8)}` : "partner")
}

/** Pull `{ rate }` numbers out of the expense `vat_rate_breakdown` jsonb. */
function vatRatesOf(breakdown: unknown): number[] {
  if (!Array.isArray(breakdown)) return []
  const rates: number[] = []
  for (const line of breakdown) {
    if (line && typeof line === "object" && "rate" in line) {
      const r = Number((line as { rate: unknown }).rate)
      if (Number.isFinite(r)) rates.push(r)
    }
  }
  return rates
}

/** Group items by a key, dropping entries with a null key. */
function groupBy<T>(
  items: T[],
  key: (t: T) => string | null,
): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!k) continue
    const arr = out.get(k)
    if (arr) arr.push(item)
    else out.set(k, [item])
  }
  return out
}

// --- detectors --------------------------------------------------------------

/** Duplicate expenses: same supplier + same document_number, seen more than once. */
function duplicateExpenses(expenses: ExpenseLike[]): Anomaly[] {
  const out: Anomaly[] = []
  const groups = groupBy(
    expenses.filter((e) => e.document_number && e.supplier_contact_id),
    (e) =>
      `${e.supplier_contact_id}::${e.document_number!.trim().toLowerCase()}`,
  )
  for (const dupes of groups.values()) {
    if (dupes.length < 2) continue
    const [, ...rest] = dupes
    const who = counterparty(
      dupes[0].supplier_name,
      dupes[0].supplier_contact_id,
    )
    for (const e of rest) {
      out.push({
        kind: "duplicate",
        severity: "warning",
        message: `Možný duplicitný náklad od „${who}" s číslom ${e.document_number} (${dupes.length}×).`,
        entity: "expense",
        entityId: e.id,
      })
    }
  }
  return out
}

/** Duplicate invoices: same contact + same total + near-same issue date. */
function duplicateInvoices(invoices: InvoiceLike[]): Anomaly[] {
  const out: Anomaly[] = []
  const groups = groupBy(
    invoices.filter((d) => d.contact_id && d.issue_date),
    (d) => d.contact_id,
  )
  for (const docs of groups.values()) {
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const a = docs[i]
        const b = docs[j]
        if (round2(a.total) !== round2(b.total)) continue
        if (daysBetween(a.issue_date!, b.issue_date!) > NEAR_DATE_DAYS) continue
        const who = counterparty(b.contact_name, b.contact_id)
        out.push({
          kind: "duplicate",
          severity: "warning",
          message: `Možná duplicitná faktúra pre „${who}" s rovnakou sumou a blízkym dátumom.`,
          entity: "invoice",
          entityId: b.id,
        })
        break
      }
    }
  }
  return out
}

/**
 * Outlier amounts: a total far above the counterparty's history. We flag when
 * the value exceeds `mean + 3*stddev` OR `3*median` (per §7.7). Stats are
 * computed over the *peers excluding the candidate*, so a single extreme value
 * can't inflate its own threshold. Requires >= MIN_SAMPLE peers.
 */
function outliers<T extends { id: string; total: number }>(
  items: T[],
  key: (t: T) => string | null,
  name: (t: T) => string,
  entity: "invoice" | "expense",
): Anomaly[] {
  const out: Anomaly[] = []
  for (const peers of groupBy(items, key).values()) {
    if (peers.length <= MIN_SAMPLE) continue
    for (const p of peers) {
      const v = Math.abs(p.total)
      // Baseline from the other peers, so the candidate can't inflate its own
      // threshold (a single huge value would otherwise blow up the stddev).
      const rest = peers.filter((q) => q !== p).map((q) => Math.abs(q.total))
      const m = mean(rest)
      const med = median(rest)
      if (med <= 0) continue
      const sigmaThreshold = m + 3 * stddev(rest)
      if (v > sigmaThreshold || v > 3 * med) {
        out.push({
          kind: "outlier",
          severity: "info",
          message: `Nezvyčajne vysoká suma u „${name(p)}" (oproti priemeru ${round2(m)}).`,
          entity,
          entityId: p.id,
        })
      }
    }
  }
  return out
}

/** Suspicious VAT: unknown rate, or payer invoice where vat_total ≠ subtotal×rate. */
function suspiciousVat(input: DetectInput): Anomaly[] {
  const out: Anomaly[] = []

  for (const e of input.expenses) {
    const rates = vatRatesOf(e.vat_rate_breakdown)
    const bad = rates.find((r) => !ALLOWED_VAT_RATES.has(r))
    if (bad !== undefined) {
      out.push({
        kind: "vat",
        severity: "warning",
        message: `Podozrivá sadzba DPH ${bad}% na náklade ${e.document_number ?? e.id.slice(0, 8)}.`,
        entity: "expense",
        entityId: e.id,
      })
    }
  }

  for (const d of input.invoices) {
    const subtotal = d.subtotal ?? null
    const vat = d.vat_total ?? null
    // Only meaningful for VAT payers with positive base; skip non-payer modes.
    if (
      d.vat_mode &&
      d.vat_mode !== "payer" &&
      d.vat_mode !== "vat" &&
      d.vat_mode !== "standard"
    ) {
      continue
    }
    if (subtotal === null || vat === null || subtotal <= 0) continue
    const impliedRate = (vat / subtotal) * 100
    const nearest = [...ALLOWED_VAT_RATES].some(
      (r) => Math.abs(impliedRate - r) <= 1,
    )
    if (!nearest) {
      out.push({
        kind: "vat",
        severity: "warning",
        message: `DPH na faktúre ${d.number ?? d.id.slice(0, 8)} nezodpovedá žiadnej štandardnej sadzbe (≈ ${round2(impliedRate)}%).`,
        entity: "invoice",
        entityId: d.id,
      })
    }
  }

  return out
}

/** Missing counterpart: expense without supplier, invoice without contact. */
function missingCounterpart(input: DetectInput): Anomaly[] {
  const out: Anomaly[] = []
  for (const e of input.expenses) {
    if (!e.supplier_contact_id) {
      out.push({
        kind: "missing",
        severity: "info",
        message: `Náklad ${e.document_number ?? e.id.slice(0, 8)} nemá priradeného dodávateľa.`,
        entity: "expense",
        entityId: e.id,
      })
    }
  }
  for (const d of input.invoices) {
    if (!d.contact_id) {
      out.push({
        kind: "missing",
        severity: "info",
        message: `Faktúra ${d.number ?? d.id.slice(0, 8)} nemá priradeného odberateľa.`,
        entity: "invoice",
        entityId: d.id,
      })
    }
  }
  return out
}

/**
 * Run every heuristic over the dataset and return a flat, de-duplicated list of
 * anomalies sorted by severity (danger → warning → info). Pure function.
 */
export function detectAnomalies(input: DetectInput): Anomaly[] {
  const { invoices, expenses } = input
  const flags: Anomaly[] = [
    ...duplicateExpenses(expenses),
    ...duplicateInvoices(invoices),
    ...outliers(
      expenses,
      (e) => e.supplier_contact_id,
      (e) => counterparty(e.supplier_name, e.supplier_contact_id),
      "expense",
    ),
    ...outliers(
      invoices,
      (d) => d.contact_id,
      (d) => counterparty(d.contact_name, d.contact_id),
      "invoice",
    ),
    ...suspiciousVat(input),
    ...missingCounterpart(input),
  ]

  // Collapse exact duplicates (same kind+entity+id) that different passes
  // could in theory emit, keeping the first occurrence.
  const seen = new Set<string>()
  const unique = flags.filter((f) => {
    const k = `${f.kind}|${f.entity}|${f.entityId}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const rank: Record<Anomaly["severity"], number> = {
    danger: 0,
    warning: 1,
    info: 2,
  }
  return unique.sort((a, b) => rank[a.severity] - rank[b.severity])
}
