/**
 * Money helpers. We compute in floating point but round deterministically to
 * 2 decimals (cents) using half-up (the SK accounting convention) at every
 * line and document boundary, so VAT never accumulates rounding error.
 */

/** Round to `decimals` places, half-up, guarding against binary float artifacts. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  // Number.EPSILON nudge fixes cases like 1.005 -> 1.00 that should be 1.01.
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Round a monetary amount to whole cents (2 decimals). */
export function round2(value: number): number {
  return round(value, 2)
}

/**
 * Format a monetary amount in Slovak style: "1 234,56 €".
 * Defaults to EUR / sk-SK; pass currency/locale for CZ etc.
 */
export function formatMoney(
  value: number,
  currency = "EUR",
  locale = "sk-SK",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
