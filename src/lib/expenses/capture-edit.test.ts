import { describe, it, expect } from "vitest"
import {
  parseAmount,
  applyEdit,
  fieldToInput,
  totalsMismatch,
} from "@/lib/expenses/capture-edit"
import type { ExtractedDocument } from "@/lib/ai/extractor"

const doc = (over: Partial<ExtractedDocument> = {}): ExtractedDocument => ({
  supplierName: "Potraviny s.r.o.",
  supplierIco: "12345678",
  supplierIcDph: null,
  documentNumber: "B-1",
  issueDate: "2026-08-05",
  supplyDate: null,
  dueDate: null,
  currency: "EUR",
  iban: null,
  variableSymbol: null,
  subtotal: 100,
  vatTotal: 19,
  total: 119,
  vatRate: null,
  lines: [],
  confidence: 0.9,
  ...over,
})

describe("parseAmount", () => {
  it("berie desatinnú čiarku aj bodku", () => {
    // Slovenská klávesnica píše čiarku; `Number("12,50")` je NaN.
    expect(parseAmount("12,50")).toBe(12.5)
    expect(parseAmount("12.50")).toBe(12.5)
  })

  it("znesie menu a medzery na tisícky", () => {
    expect(parseAmount("1 234,56 €")).toBe(1234.56)
    expect(parseAmount("1 234,56")).toBe(1234.56)
  })

  it("prázdne pole je chýbajúci údaj, nie nula", () => {
    expect(parseAmount("")).toBeNull()
    expect(parseAmount("-")).toBeNull()
  })

  it("nezmysel nezmení na nulu", () => {
    expect(parseAmount("asdf")).toBeNull()
  })

  it("záporná suma prejde — dobropis existuje", () => {
    expect(parseAmount("-12,50")).toBe(-12.5)
  })
})

describe("applyEdit", () => {
  it("opraví meno dodávateľa", () => {
    const next = applyEdit(doc(), "supplierName", "Potraviny s. r. o.")
    expect(next.supplierName).toBe("Potraviny s. r. o.")
  })

  it("ostatné polia nechá tak", () => {
    const next = applyEdit(doc(), "supplierName", "Iný")
    expect(next.subtotal).toBe(100)
    expect(next.confidence).toBe(0.9)
  })

  it("sumu prevedie na číslo", () => {
    expect(applyEdit(doc(), "total", "119,90").total).toBe(119.9)
  })

  it("vymazané pole je null, nie prázdny reťazec", () => {
    expect(applyEdit(doc(), "supplierIco", "").supplierIco).toBeNull()
    expect(applyEdit(doc(), "vatTotal", "").vatTotal).toBeNull()
  })

  it("pôvodný doklad nemení", () => {
    const original = doc()
    applyEdit(original, "total", "1")
    expect(original.total).toBe(119)
  })
})

describe("fieldToInput", () => {
  it("chýbajúcu hodnotu ukáže ako prázdne pole", () => {
    expect(fieldToInput(doc({ dueDate: null }), "dueDate")).toBe("")
  })

  it("sumu ukáže ako číslo", () => {
    expect(fieldToInput(doc(), "subtotal")).toBe("100")
  })
})

describe("totalsMismatch", () => {
  it("sediaci doklad neupozorňuje", () => {
    expect(totalsMismatch(doc())).toBeNull()
  })

  it("upozorní, keď ručná oprava rozhodí súčet", () => {
    // Používateľ opraví „spolu" podľa bločka, základ ostane starý.
    expect(totalsMismatch(doc({ total: 150 }))).toContain("Skontroluj")
  })

  it("halier zaokrúhlenia toleruje", () => {
    expect(
      totalsMismatch(doc({ subtotal: 100, vatTotal: 19, total: 119.01 })),
    ).toBeNull()
  })

  it("bez súm sa nevyjadruje", () => {
    expect(totalsMismatch(doc({ subtotal: null }))).toBeNull()
    expect(totalsMismatch(doc({ total: null }))).toBeNull()
  })

  it("chýbajúcu DPH berie ako nulovú", () => {
    expect(
      totalsMismatch(doc({ vatTotal: null, subtotal: 119, total: 119 })),
    ).toBeNull()
  })
})
