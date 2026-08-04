/**
 * How a document type is presented (pure, no I/O).
 *
 * The PDF and the detail view used to be hardcoded as an invoice: a delivery
 * note would print prices, the VAT recap and a payment QR code, and a quote
 * would say "Spolu na uhradu". Neither is correct, so the rules live here in
 * one place instead of being spread over the renderers.
 *
 * There is no `show_prices` column yet — everything is derived from the type.
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

/** Presentation rules for the given document type. */
export function documentPresentation(type: DocumentType): DocumentPresentation {
  return PRESENTATION[type]
}
