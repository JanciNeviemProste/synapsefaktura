/**
 * Currently selectable VAT rates for new documents (§5.1, from 1.1.2025).
 * Historical rates (20/10) live in the `vat_rates` table and remain selectable
 * for back-dated documents, but the editor defaults offer the active set.
 */
export const CURRENT_VAT_RATES = [23, 19, 5, 0] as const

export const VAT_RATE_LABELS: Record<number, string> = {
  23: "23 % (základná)",
  19: "19 % (znížená)",
  5: "5 % (znížená)",
  0: "0 % (oslobodené)",
  20: "20 % (historická)",
  10: "10 % (historická)",
}

export function vatRateLabel(rate: number): string {
  return VAT_RATE_LABELS[rate] ?? `${rate} %`
}
