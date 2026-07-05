/**
 * Currently selectable VAT rates for new documents (§5.1, from 1.1.2025).
 * FAKT (overené 2026-07-05): novelou zákona č. 222/2004 Z. z. platnou od
 * 1.1.2025 je základná sadzba DPH **23 %**, znížené sadzby **19 %** a **5 %**.
 * Historické sadzby (20/10) žijú v `vat_rates` tabuľke a ostávajú voliteľné pre
 * spätne datované doklady, no editor ponúka aktívnu sadu.
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
