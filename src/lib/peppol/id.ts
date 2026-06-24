/**
 * Slovak Peppol participant identifiers.
 *
 * SK participants use the EAS/ICD scheme **0245** with the 10-digit DIČ as the
 * value, e.g. `0245:2020317068` (§5.5).
 *
 * // TODO: verify against official Finančná správa source — confirm the exact
 * // EAS scheme id (0245) and DIČ normalization (length / check rules) against
 * // the SK Solution Architecture (v1.2+) and Peppol BIS SK transposition before
 * // production. Build to the documented 0245:[10-digit DIČ] for now.
 */

export const SK_PEPPOL_SCHEME = "0245"

/** Strip everything but digits (DIČ may arrive as "SK2020317068" or spaced). */
export function normalizeDic(dic: string): string {
  return (dic ?? "").replace(/\D/g, "")
}

/** SK DIČ is a 10-digit number. */
export function isValidSlovakDic(dic: string): boolean {
  return /^\d{10}$/.test(normalizeDic(dic))
}

/**
 * Build the SK Peppol id from a DIČ. Returns null if the DIČ is not a plausible
 * 10-digit number (caller surfaces a "set your DIČ first" message).
 */
export function slovakPeppolId(dic: string | null | undefined): string | null {
  if (!dic) return null
  const digits = normalizeDic(dic)
  if (!isValidSlovakDic(digits)) return null
  return `${SK_PEPPOL_SCHEME}:${digits}`
}

export type ParsedPeppolId = { scheme: string; value: string }

/** Parse `scheme:value`. Returns null if malformed. */
export function parsePeppolId(
  peppolId: string | null | undefined,
): ParsedPeppolId | null {
  if (!peppolId) return null
  const idx = peppolId.indexOf(":")
  if (idx <= 0 || idx === peppolId.length - 1) return null
  return {
    scheme: peppolId.slice(0, idx),
    value: peppolId.slice(idx + 1),
  }
}

/** Loose well-formedness check (scheme + non-empty value). */
export function isValidPeppolId(peppolId: string | null | undefined): boolean {
  return parsePeppolId(peppolId) !== null
}
