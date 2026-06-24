import { describe, it, expect } from "vitest"
import { computeInvoice, computeLine, isZeroVatMode } from "./engine"

describe("computeLine", () => {
  it("computes a simple payer line at 23%", () => {
    const l = computeLine({ quantity: 1, unitPrice: 100, vatRate: 23 }, "payer")
    expect(l.lineBase).toBe(100)
    expect(l.lineVat).toBe(23)
    expect(l.lineTotal).toBe(123)
    expect(l.effectiveVatRate).toBe(23)
  })

  it("applies a line discount before VAT", () => {
    const l = computeLine(
      { quantity: 2, unitPrice: 100, vatRate: 23, discountPct: 10 },
      "payer",
    )
    expect(l.lineBase).toBe(180) // 200 - 10%
    expect(l.lineVat).toBe(41.4)
    expect(l.lineTotal).toBe(221.4)
  })

  it("rounds VAT per line, half-up", () => {
    const l = computeLine(
      { quantity: 3, unitPrice: 9.99, vatRate: 23 },
      "payer",
    )
    expect(l.lineBase).toBe(29.97)
    expect(l.lineVat).toBe(6.89) // 6.8931 -> 6.89
    expect(l.lineTotal).toBe(36.86)
  })

  it("forces 0% VAT for reverse charge but keeps the base", () => {
    const l = computeLine(
      { quantity: 1, unitPrice: 100, vatRate: 23 },
      "reverse_charge_domestic",
    )
    expect(l.effectiveVatRate).toBe(0)
    expect(l.lineBase).toBe(100)
    expect(l.lineVat).toBe(0)
    expect(l.lineTotal).toBe(100)
  })

  it("forces 0% VAT for a non-payer", () => {
    const l = computeLine(
      { quantity: 1, unitPrice: 50, vatRate: 23 },
      "non_payer",
    )
    expect(l.lineVat).toBe(0)
    expect(l.lineTotal).toBe(50)
  })
})

describe("isZeroVatMode", () => {
  it("classifies modes", () => {
    expect(isZeroVatMode("payer")).toBe(false)
    expect(isZeroVatMode("oss")).toBe(false)
    expect(isZeroVatMode("non_payer")).toBe(true)
    expect(isZeroVatMode("reverse_charge_domestic")).toBe(true)
    expect(isZeroVatMode("intra_eu_b2b")).toBe(true)
    expect(isZeroVatMode("export")).toBe(true)
    expect(isZeroVatMode("exempt")).toBe(true)
  })
})

describe("computeInvoice", () => {
  it("matches the brief example: 200 € + DPH 23%", () => {
    const t = computeInvoice(
      [{ quantity: 1, unitPrice: 200, vatRate: 23 }],
      "payer",
    )
    expect(t.subtotal).toBe(200)
    expect(t.vatTotal).toBe(46)
    expect(t.total).toBe(246)
    expect(t.recap).toHaveLength(1)
    expect(t.recap[0]).toEqual({ rate: 23, base: 200, vat: 46, total: 246 })
  })

  it("builds a recapitulation grouped by rate, sorted desc", () => {
    const t = computeInvoice(
      [
        { quantity: 1, unitPrice: 100, vatRate: 23 }, // base 100, vat 23
        { quantity: 1, unitPrice: 100, vatRate: 5 }, // base 100, vat 5
        { quantity: 2, unitPrice: 50, vatRate: 23 }, // base 100, vat 23
      ],
      "payer",
    )
    expect(t.recap.map((r) => r.rate)).toEqual([23, 5])
    const r23 = t.recap.find((r) => r.rate === 23)!
    expect(r23.base).toBe(200)
    expect(r23.vat).toBe(46)
    const r5 = t.recap.find((r) => r.rate === 5)!
    expect(r5.base).toBe(100)
    expect(r5.vat).toBe(5)
    expect(t.subtotal).toBe(300)
    expect(t.vatTotal).toBe(51)
    expect(t.total).toBe(351)
  })

  it("zeroes all VAT for an exempt invoice", () => {
    const t = computeInvoice(
      [
        { quantity: 1, unitPrice: 100, vatRate: 23 },
        { quantity: 1, unitPrice: 50, vatRate: 5 },
      ],
      "exempt",
    )
    expect(t.vatTotal).toBe(0)
    expect(t.subtotal).toBe(150)
    expect(t.total).toBe(150)
    expect(t.recap).toHaveLength(1)
    expect(t.recap[0].rate).toBe(0)
  })

  it("handles an empty invoice", () => {
    const t = computeInvoice([], "payer")
    expect(t.subtotal).toBe(0)
    expect(t.vatTotal).toBe(0)
    expect(t.total).toBe(0)
    expect(t.recap).toHaveLength(0)
  })
})
