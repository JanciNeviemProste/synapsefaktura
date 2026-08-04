/**
 * Which document type may be converted into which (pure, no I/O).
 *
 * A conversion never rewrites the source document — it creates a NEW draft of
 * the target type that points back via `documents.related_document_id`. Only
 * the combinations below make sense in the SK workflow; everything else is
 * refused so nobody turns a delivery note into a credit note by accident.
 */

import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"

export type ConversionCheck = { ok: true } | { ok: false; error: string }

const CONVERSIONS: Record<DocumentType, readonly DocumentType[]> = {
  quote: ["invoice", "order_received", "delivery_note"],
  order_received: ["invoice", "delivery_note"],
  proforma: ["invoice", "tax_doc_payment"],
  invoice: ["credit_note", "delivery_note"],
  // Types nothing converts from (yet) — an empty list means "no conversion".
  advance: [],
  tax_doc_payment: [],
  credit_note: [],
  order_issued: [],
  delivery_note: [],
  draft: [],
}

/** Types the given document type can be converted to (possibly none). */
export function conversionTargets(from: DocumentType): readonly DocumentType[] {
  return CONVERSIONS[from]
}

/** True when `from -> to` is an allowed conversion. */
export function canConvertDocument(
  from: DocumentType,
  to: DocumentType,
): boolean {
  return CONVERSIONS[from].includes(to)
}

/** Same check as `canConvertDocument`, with a message ready for the user. */
export function checkConversion(
  from: DocumentType,
  to: DocumentType,
): ConversionCheck {
  if (canConvertDocument(from, to)) return { ok: true }

  const fromLabel = DOCUMENT_TYPE_LABELS[from]
  const targets = CONVERSIONS[from]

  if (targets.length === 0) {
    return {
      ok: false,
      error: `Doklad typu „${fromLabel}“ sa nedá previesť na iný typ.`,
    }
  }

  const allowed = targets.map((t) => DOCUMENT_TYPE_LABELS[t]).join(", ")
  return {
    ok: false,
    error:
      `Doklad typu „${fromLabel}“ sa nedá previesť na „${DOCUMENT_TYPE_LABELS[to]}“. ` +
      `Možnosti: ${allowed}.`,
  }
}
