import { describe, it, expect } from "vitest"
import {
  REPORTED_DOCUMENT_TYPES,
  isReportedDocumentType,
} from "@/lib/documents/reporting"
import { computeSummary } from "@/lib/reports/summary"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"

describe("REPORTED_DOCUMENT_TYPES", () => {
  it("obsahuje dobropis — inak by neznizoval vykazany obrat ani DPH", () => {
    expect(isReportedDocumentType("credit_note")).toBe(true)
    expect(isReportedDocumentType("invoice")).toBe(true)
  })

  it("nepusti dnu doklady, ktore nie su uctovnym dokladom", () => {
    // Zalohova faktura ani cenova ponuka nezakladaju danovu povinnost.
    for (const t of [
      "proforma",
      "advance",
      "quote",
      "order_issued",
      "order_received",
      "delivery_note",
      "draft",
    ] as const) {
      expect(isReportedDocumentType(t)).toBe(false)
    }
  })

  it("uvadza len existujuce typy dokladov", () => {
    for (const t of REPORTED_DOCUMENT_TYPES) {
      expect(Object.hasOwn(DOCUMENT_TYPE_LABELS, t)).toBe(true)
    }
  })

  it("danovy doklad k platbe zostava vonku, kym nevie appka odpocitat zalohu", () => {
    // Ked odpocet zalohy pribudne, tento test padne — a to je zamer. Jeho
    // zmena ma byt vedomym rozhodnutim, nie vedlajsim ucinkom inej upravy.
    expect(isReportedDocumentType("tax_doc_payment" as DocumentType)).toBe(
      false,
    )
  })
})

describe("dobropis vo vykaze", () => {
  const invoice = {
    status: "issued",
    subtotal: 1000,
    vat_total: 230,
    total: 1230,
    paid_amount: 1230,
  }
  // Dobropis vznika prevodom s negovanym mnozstvom, takze uz je zaporny.
  const creditNote = {
    status: "issued",
    subtotal: -200,
    vat_total: -46,
    total: -246,
    paid_amount: 0,
  }

  it("znizuje obrat aj DPH na odvod", () => {
    const withoutIt = computeSummary([invoice], [])
    const withIt = computeSummary([invoice, creditNote], [])

    expect(withoutIt.incomeBase).toBe(1000)
    expect(withoutIt.vatLiability).toBe(230)

    expect(withIt.incomeBase).toBe(800)
    expect(withIt.incomeTotal).toBe(984)
    expect(withIt.vatLiability).toBe(184)
  })

  it("neznizuje prijem, kym sa peniaze realne nevratili", () => {
    // `paid_amount` na dobropise ostava 0, kym sa vratka nezaeviduje.
    const s = computeSummary([invoice, creditNote], [])
    expect(s.cashIn).toBe(1230)
  })
})
