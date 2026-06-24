import { round } from "@/lib/money"

/**
 * Approximate token→cost table (USD per 1M tokens). For per-org cost logging,
 * not billing. TODO: verify against the provider's current price sheet.
 */
const RATES: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const r = RATES[model] ?? RATES["gemini-2.5-flash"]
  return round(
    (inputTokens / 1e6) * r.input + (outputTokens / 1e6) * r.output,
    6,
  )
}
