import { round2 } from "@/lib/money"
import type { VatMode } from "@/lib/validation/org"

/**
 * VAT engine — pure, deterministic, unit-tested. Computes per-line base/VAT/total
 * and a tax recapitulation (daňová rekapitulácia) grouped by rate, per §5.1/§5.3.
 *
 * Rounding: half-up to cents at every line (SK convention); document totals are
 * the sum of already-rounded line values, so VAT never drifts.
 */

export interface InvoiceLineInput {
  quantity: number
  unitPrice: number
  /** Per-line VAT rate in percent (e.g. 23, 19, 5, 0). */
  vatRate: number
  /** Optional line discount in percent (0–100). */
  discountPct?: number
}

export interface ComputedLine extends InvoiceLineInput {
  discountPct: number
  /** Rate actually applied after VAT-mode override (0 for reverse-charge etc.). */
  effectiveVatRate: number
  lineBase: number
  lineVat: number
  lineTotal: number
}

export interface VatRecapRow {
  rate: number
  base: number
  vat: number
  total: number
}

export interface InvoiceTotals {
  lines: ComputedLine[]
  recap: VatRecapRow[]
  subtotal: number
  vatTotal: number
  total: number
}

/**
 * VAT modes where no output VAT is charged (0%): the supplier doesn't add VAT.
 * `payer` and `oss` keep the per-line rate (for OSS the user enters the
 * destination-country rate). `non_payer` and the reverse-charge / exempt / export
 * modes force 0%.
 */
const ZERO_VAT_MODES: ReadonlySet<VatMode> = new Set<VatMode>([
  "non_payer",
  "reverse_charge_domestic",
  "intra_eu_b2b",
  "export",
  "exempt",
])

export function isZeroVatMode(mode: VatMode): boolean {
  return ZERO_VAT_MODES.has(mode)
}

export function computeLine(
  line: InvoiceLineInput,
  mode: VatMode,
): ComputedLine {
  const discountPct = line.discountPct ?? 0
  const effectiveVatRate = isZeroVatMode(mode) ? 0 : line.vatRate

  const gross = line.quantity * line.unitPrice
  const afterDiscount = gross * (1 - discountPct / 100)
  const lineBase = round2(afterDiscount)
  const lineVat = round2((lineBase * effectiveVatRate) / 100)
  const lineTotal = round2(lineBase + lineVat)

  return {
    ...line,
    discountPct,
    effectiveVatRate,
    lineBase,
    lineVat,
    lineTotal,
  }
}

/** Build the VAT recapitulation grouped by effective rate, sorted desc. */
export function buildRecap(lines: ComputedLine[]): VatRecapRow[] {
  const byRate = new Map<number, VatRecapRow>()
  for (const l of lines) {
    const row = byRate.get(l.effectiveVatRate) ?? {
      rate: l.effectiveVatRate,
      base: 0,
      vat: 0,
      total: 0,
    }
    row.base = round2(row.base + l.lineBase)
    row.vat = round2(row.vat + l.lineVat)
    row.total = round2(row.base + row.vat)
    byRate.set(l.effectiveVatRate, row)
  }
  return [...byRate.values()].sort((a, b) => b.rate - a.rate)
}

export function computeInvoice(
  lines: InvoiceLineInput[],
  mode: VatMode,
): InvoiceTotals {
  const computed = lines.map((l) => computeLine(l, mode))
  const recap = buildRecap(computed)
  const subtotal = round2(computed.reduce((s, l) => s + l.lineBase, 0))
  const vatTotal = round2(computed.reduce((s, l) => s + l.lineVat, 0))
  const total = round2(subtotal + vatTotal)
  return { lines: computed, recap, subtotal, vatTotal, total }
}
