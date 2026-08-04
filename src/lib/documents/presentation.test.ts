import { describe, it, expect } from "vitest"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "./labels"
import { documentPresentation } from "./presentation"

const ALL_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]

describe("documentPresentation", () => {
  it("covers every document type", () => {
    expect(ALL_TYPES).toHaveLength(10)
    for (const type of ALL_TYPES) {
      expect(documentPresentation(type)).toBeDefined()
    }
  })

  it("treats invoice-like documents as a request for payment", () => {
    for (const type of [
      "invoice",
      "tax_doc_payment",
      "proforma",
      "advance",
    ] as const) {
      expect(documentPresentation(type)).toEqual({
        showPrices: true,
        showVatRecap: true,
        showPaymentBlock: true,
        showQr: true,
        showVariableSymbol: true,
        isPayable: true,
        totalLabelKey: "toPay",
        signatureArea: false,
      })
    }
  })

  it("renders a draft like an invoice", () => {
    expect(documentPresentation("draft")).toEqual(
      documentPresentation("invoice"),
    )
  })

  it("prices quotes and orders but never asks for payment", () => {
    for (const type of ["quote", "order_issued", "order_received"] as const) {
      expect(documentPresentation(type)).toEqual({
        showPrices: true,
        showVatRecap: true,
        showPaymentBlock: false,
        showQr: false,
        showVariableSymbol: false,
        isPayable: false,
        totalLabelKey: "total",
        signatureArea: false,
      })
    }
  })

  it("does not put a payment block on a quote", () => {
    const p = documentPresentation("quote")
    expect(p.showPaymentBlock).toBe(false)
    expect(p.showQr).toBe(false)
    expect(p.isPayable).toBe(false)
    // "Spolu na uhradu" would be wrong on a document nobody has to pay
    expect(p.totalLabelKey).toBe("total")
  })

  it("prints a delivery note without prices, VAT recap or QR", () => {
    expect(documentPresentation("delivery_note")).toEqual({
      showPrices: false,
      showVatRecap: false,
      showPaymentBlock: false,
      showQr: false,
      showVariableSymbol: false,
      isPayable: false,
      totalLabelKey: "total",
      signatureArea: true,
    })
  })

  it("gives only the delivery note a signature area", () => {
    for (const type of ALL_TYPES) {
      expect(documentPresentation(type).signatureArea).toBe(
        type === "delivery_note",
      )
    }
  })

  it("keeps the variable symbol on a credit note for matching", () => {
    expect(documentPresentation("credit_note")).toEqual({
      showPrices: true,
      showVatRecap: true,
      showPaymentBlock: false,
      showQr: false,
      showVariableSymbol: true,
      isPayable: false,
      totalLabelKey: "total",
      signatureArea: false,
    })
  })

  it("never shows a QR code or payment block on a non-payable document", () => {
    for (const type of ALL_TYPES) {
      const p = documentPresentation(type)
      if (!p.isPayable) {
        expect(p.showQr).toBe(false)
        expect(p.showPaymentBlock).toBe(false)
        expect(p.totalLabelKey).toBe("total")
      }
    }
  })

  it("never shows amounts when prices are hidden", () => {
    for (const type of ALL_TYPES) {
      const p = documentPresentation(type)
      if (!p.showPrices) {
        expect(p.showVatRecap).toBe(false)
        expect(p.showPaymentBlock).toBe(false)
        expect(p.showQr).toBe(false)
      }
    }
  })
})
