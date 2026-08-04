/**
 * Variable symbol derived from a document number (pure, no I/O).
 *
 * Party matching in `lib/matching` and the PDF both reduce the document number
 * to its digits — this is the same rule, kept in one place so the value stored
 * in `documents.variable_symbol` cannot drift from what the customer sees.
 *
 * A VS is at most 10 digits (bank clearing limit). Longer numbers are cut from
 * the LEFT: the tail (year + counter) is what identifies the document, while
 * the leading digits are the least significant part of a prefix.
 */

/** Maximalna dlzka variabilneho symbolu v SK/CZ bankovom styku. */
export const VARIABLE_SYMBOL_MAX_LENGTH = 10

/**
 * Returns the variable symbol for a document number, or null when the number
 * carries no digits at all (an empty VS is not a valid payment reference).
 */
export function variableSymbolFromNumber(
  number: string | null | undefined,
): string | null {
  const digits = (number ?? "").replace(/\D/g, "")
  if (!digits) return null
  return digits.slice(-VARIABLE_SYMBOL_MAX_LENGTH)
}
