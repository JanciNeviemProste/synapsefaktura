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

describe("documentPresentation — prepinace na doklade", () => {
  it("null aj prazdny objekt nechavaju rozhodnut typ", () => {
    for (const type of ALL_TYPES) {
      const base = documentPresentation(type)
      expect(documentPresentation(type, {})).toEqual(base)
      expect(
        documentPresentation(type, {
          showPrices: null,
          showQr: null,
          signatureArea: null,
        }),
      ).toEqual(base)
    }
  })

  it("dodaci list vie na poziadanie tlacit ceny, ale nestane sa fakturou", () => {
    const p = documentPresentation("delivery_note", { showPrices: true })
    expect(p.showPrices).toBe(true)
    expect(p.showVatRecap).toBe(true)
    // Ceny ano — vyzva na uhradu nie. O tom rozhoduje typ.
    expect(p.showPaymentBlock).toBe(false)
    expect(p.showQr).toBe(false)
    expect(p.isPayable).toBe(false)
    expect(p.totalLabelKey).toBe("total")
  })

  it("vypnute ceny zhasnu aj DPH rekapitulaciu, platobny blok a QR", () => {
    const p = documentPresentation("invoice", { showPrices: false })
    expect(p).toMatchObject({
      showPrices: false,
      showVatRecap: false,
      showPaymentBlock: false,
      showQr: false,
    })
  })

  it("QR sa neda zapnut tam, kde nie je co uhradit", () => {
    // Cenova ponuka nie je vyzvou na uhradu, takze QR ostava zhasnute aj ked
    // si ho niekto vyslovne vypyta.
    expect(documentPresentation("quote", { showQr: true }).showQr).toBe(false)
    // A na doklade bez cien tiez — QR nesie sumu, ktoru doklad netlaci.
    expect(
      documentPresentation("invoice", { showPrices: false, showQr: true })
        .showQr,
    ).toBe(false)
  })

  it("QR sa da vypnut na faktrue, ktora by ho inak mala", () => {
    expect(documentPresentation("invoice").showQr).toBe(true)
    expect(documentPresentation("invoice", { showQr: false }).showQr).toBe(
      false,
    )
  })

  it("miesto na podpis sa da zapnut aj vypnut", () => {
    expect(
      documentPresentation("invoice", { signatureArea: true }).signatureArea,
    ).toBe(true)
    expect(
      documentPresentation("delivery_note", { signatureArea: false })
        .signatureArea,
    ).toBe(false)
  })

  it("prepinace nikdy neporusia invariant 'bez cien = bez suma'", () => {
    for (const type of ALL_TYPES) {
      for (const showPrices of [true, false, null] as const) {
        for (const showQr of [true, false, null] as const) {
          const p = documentPresentation(type, { showPrices, showQr })
          if (!p.showPrices) {
            expect(p.showVatRecap).toBe(false)
            expect(p.showPaymentBlock).toBe(false)
            expect(p.showQr).toBe(false)
          }
          if (p.showQr) expect(p.isPayable).toBe(true)
        }
      }
    }
  })
})
