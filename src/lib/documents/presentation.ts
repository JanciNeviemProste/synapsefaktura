/**
 * How a document type is presented (pure, no I/O).
 *
 * The PDF and the detail view used to be hardcoded as an invoice: a delivery
 * note would print prices, the VAT recap and a payment QR code, and a quote
 * would say "Spolu na uhradu". Neither is correct, so the rules live here in
 * one place instead of being spread over the renderers.
 *
 * The type gives the default. `documents.show_prices` may override it per
 * document — a delivery note with prices is a common request, and without the
 * override the column would sit in the schema unused while the user has no way
 * to ask for one.
 */

import type { DocumentType } from "@/lib/documents/labels"

export type DocumentPresentation = {
  /** Show prices and amounts at all? */
  showPrices: boolean
  /** VAT recapitulation grouped by rate. */
  showVatRecap: boolean
  /** IBAN/SWIFT/VS + amount to pay. */
  showPaymentBlock: boolean
  /** PAY by square QR code. */
  showQr: boolean
  showVariableSymbol: boolean
  /** Is the document a request for payment? */
  isPayable: boolean
  /** "Spolu na uhradu" vs plain "Spolu". */
  totalLabelKey: "toPay" | "total"
  /** Space to sign off the handover (delivery note). */
  signatureArea: boolean
}

/** Invoice-like: payable, full price + payment presentation. */
const PAYABLE: DocumentPresentation = {
  showPrices: true,
  showVatRecap: true,
  showPaymentBlock: true,
  showQr: true,
  showVariableSymbol: true,
  isPayable: true,
  totalLabelKey: "toPay",
  signatureArea: false,
}

/** Quotes and orders: prices yes, but the document does not ask for money. */
const PRICED_NOT_PAYABLE: DocumentPresentation = {
  showPrices: true,
  showVatRecap: true,
  showPaymentBlock: false,
  showQr: false,
  showVariableSymbol: false,
  isPayable: false,
  totalLabelKey: "total",
  signatureArea: false,
}

/** Credit note: priced, not payable, but keeps the VS for matching. */
const CREDIT_NOTE: DocumentPresentation = {
  ...PRICED_NOT_PAYABLE,
  showVariableSymbol: true,
}

/** Delivery note: printed without prices, with a handover signature line. */
const DELIVERY_NOTE: DocumentPresentation = {
  showPrices: false,
  showVatRecap: false,
  showPaymentBlock: false,
  showQr: false,
  showVariableSymbol: false,
  isPayable: false,
  totalLabelKey: "total",
  signatureArea: true,
}

const PRESENTATION: Record<DocumentType, DocumentPresentation> = {
  invoice: PAYABLE,
  tax_doc_payment: PAYABLE,
  proforma: PAYABLE,
  advance: PAYABLE,
  // A draft is just an unfinished document, so it renders like an invoice.
  draft: PAYABLE,
  quote: PRICED_NOT_PAYABLE,
  order_issued: PRICED_NOT_PAYABLE,
  order_received: PRICED_NOT_PAYABLE,
  credit_note: CREDIT_NOTE,
  delivery_note: DELIVERY_NOTE,
}

/**
 * Vedome nastavenie na konkretnom doklade (`documents.show_*`).
 *
 * `null`/`undefined` znamena "rozhodne typ dokladu" — preto su stlpce v DB
 * nullable. Keby mali `not null default true`, nedalo by sa odlisit vedome
 * zapnutie od nedotknuteho defaultu a dodaci list by tlacil ceny.
 */
export type PresentationOverrides = {
  showPrices?: boolean | null
  showQr?: boolean | null
  signatureArea?: boolean | null
}

/**
 * Presentation rules for the given document type, plus per-document overrides.
 *
 * Prepinace su NAD typom, nie namiesto neho:
 *
 * - `showPrices: false` zhasne aj rekapitulaciu DPH, platobny blok a QR kod.
 *   Doklad bez cien s platobnym QR kodom by bol nezmysel — QR nesie sumu,
 *   ktoru doklad netlaci.
 * - `showPrices: true` rozsvieti ceny a rekapitulaciu DPH, ale NIE platobny
 *   blok. O tom, ci je doklad vyzvou na uhradu, rozhoduje typ — dodaci list
 *   s cenami je stale dodaci list, nie faktura.
 * - `showQr` sa vzdy orezava na `showPrices && isPayable`. Zapnut QR na
 *   cenovej ponuke sa proste neda: nie je co uhradit.
 * - `signatureArea` prejde tak, ako je — miesto na podpis nikde neskodi.
 */
export function documentPresentation(
  type: DocumentType,
  overrides?: PresentationOverrides,
): DocumentPresentation {
  const base = PRESENTATION[type]
  if (!overrides) return base

  const showPrices = overrides.showPrices ?? base.showPrices

  let p: DocumentPresentation = base
  if (showPrices !== base.showPrices) {
    p = showPrices
      ? { ...base, showPrices: true, showVatRecap: true }
      : {
          ...base,
          showPrices: false,
          showVatRecap: false,
          showPaymentBlock: false,
          showQr: false,
        }
  }

  const wantsQr = overrides.showQr ?? p.showQr
  const showQr = wantsQr && p.showPrices && p.isPayable
  const signatureArea = overrides.signatureArea ?? p.signatureArea

  if (showQr === p.showQr && signatureArea === p.signatureArea) return p
  return { ...p, showQr, signatureArea }
}
