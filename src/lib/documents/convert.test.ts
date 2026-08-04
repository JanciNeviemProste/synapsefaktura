import { describe, it, expect } from "vitest"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "./labels"
import {
  canConvertDocument,
  checkConversion,
  conversionQuantitySign,
  conversionTargets,
} from "./convert"

const ALL_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]

describe("conversionQuantitySign", () => {
  it("dobropis dostane opačné znamienko", () => {
    // Dobropis znižuje základ dane — kladné sumy by tvrdili presný opak.
    expect(conversionQuantitySign("credit_note")).toBe(-1)
  })

  it("každý iný typ si znamienko zachová", () => {
    for (const t of ALL_TYPES.filter((x) => x !== "credit_note")) {
      expect(conversionQuantitySign(t)).toBe(1)
    }
  })
})

describe("conversionTargets", () => {
  it("covers every document type", () => {
    expect(ALL_TYPES).toHaveLength(10)
    for (const type of ALL_TYPES) {
      expect(conversionTargets(type)).toBeDefined()
    }
  })

  it("allows exactly the documented conversions", () => {
    expect(conversionTargets("quote")).toEqual([
      "invoice",
      "order_received",
      "delivery_note",
    ])
    expect(conversionTargets("order_received")).toEqual([
      "invoice",
      "delivery_note",
    ])
    expect(conversionTargets("proforma")).toEqual([
      "invoice",
      "tax_doc_payment",
    ])
    expect(conversionTargets("invoice")).toEqual([
      "credit_note",
      "delivery_note",
    ])
  })

  it("offers nothing for the remaining types", () => {
    for (const type of [
      "advance",
      "tax_doc_payment",
      "credit_note",
      "order_issued",
      "delivery_note",
      "draft",
    ] as const) {
      expect(conversionTargets(type)).toEqual([])
    }
  })

  it("never offers a conversion to the same type", () => {
    for (const type of ALL_TYPES) {
      expect(conversionTargets(type)).not.toContain(type)
    }
  })
})

describe("canConvertDocument", () => {
  it("accepts the allowed pairs", () => {
    expect(canConvertDocument("quote", "invoice")).toBe(true)
    expect(canConvertDocument("proforma", "tax_doc_payment")).toBe(true)
    expect(canConvertDocument("invoice", "credit_note")).toBe(true)
    expect(canConvertDocument("order_received", "delivery_note")).toBe(true)
  })

  it("rejects everything else", () => {
    // Not listed: a proforma is not a delivery note, a credit note converts
    // to nothing, and conversions do not run backwards.
    expect(canConvertDocument("proforma", "delivery_note")).toBe(false)
    expect(canConvertDocument("credit_note", "invoice")).toBe(false)
    expect(canConvertDocument("invoice", "quote")).toBe(false)
    expect(canConvertDocument("delivery_note", "invoice")).toBe(false)
    expect(canConvertDocument("invoice", "invoice")).toBe(false)
  })
})

describe("checkConversion", () => {
  it("passes an allowed conversion", () => {
    expect(checkConversion("quote", "invoice")).toEqual({ ok: true })
  })

  it("says which conversions are possible instead", () => {
    const res = checkConversion("quote", "credit_note")
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("Cenová ponuka")
    expect(res.error).toContain("Dobropis")
    expect(res.error).toContain("Faktúra")
  })

  it("says plainly that a type converts to nothing", () => {
    const res = checkConversion("delivery_note", "invoice")
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe(
      "Doklad typu „Dodací list“ sa nedá previesť na iný typ.",
    )
  })

  it("gives a non-empty message for every refused pair", () => {
    for (const from of ALL_TYPES) {
      for (const to of ALL_TYPES) {
        const res = checkConversion(from, to)
        expect(res.ok).toBe(canConvertDocument(from, to))
        if (!res.ok) expect(res.error.length).toBeGreaterThan(0)
      }
    }
  })
})
