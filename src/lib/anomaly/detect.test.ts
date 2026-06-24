import { describe, expect, it } from "vitest"

import {
  detectAnomalies,
  mean,
  median,
  stddev,
  type ExpenseLike,
  type InvoiceLike,
} from "./detect"

function expense(over: Partial<ExpenseLike>): ExpenseLike {
  return {
    id: crypto.randomUUID(),
    document_number: null,
    total: 100,
    supplier_contact_id: "sup-1",
    issue_date: "2026-01-01",
    vat_rate_breakdown: [{ rate: 23, base: 100, vat: 23 }],
    supplier_name: "Dodávateľ A",
    ...over,
  }
}

function invoice(over: Partial<InvoiceLike>): InvoiceLike {
  return {
    id: crypto.randomUUID(),
    number: "2026001",
    type: "invoice",
    total: 100,
    subtotal: 100,
    vat_total: 23,
    contact_id: "cust-1",
    issue_date: "2026-01-01",
    vat_mode: "payer",
    contact_name: "Odberateľ A",
    ...over,
  }
}

describe("statistics helpers", () => {
  it("computes mean, stddev, median", () => {
    expect(mean([2, 4, 6])).toBe(4)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(stddev([4, 4, 4])).toBe(0)
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2)
  })
})

describe("detectAnomalies", () => {
  it("returns [] for a tiny clean dataset", () => {
    const result = detectAnomalies({
      invoices: [invoice({})],
      expenses: [expense({ document_number: "F-1" })],
    })
    expect(result).toEqual([])
  })

  it("flags a duplicate expense (same supplier + document_number)", () => {
    const result = detectAnomalies({
      invoices: [],
      expenses: [
        expense({ document_number: "DUP-99", supplier_contact_id: "sup-x" }),
        expense({ document_number: "DUP-99", supplier_contact_id: "sup-x" }),
      ],
    })
    const dup = result.filter((a) => a.kind === "duplicate")
    expect(dup).toHaveLength(1)
    expect(dup[0].entity).toBe("expense")
  })

  it("flags an outlier invoice far above the contact's mean", () => {
    const normal = Array.from({ length: 8 }, () =>
      invoice({ contact_id: "big-cust", total: 100, vat_total: 23 }),
    )
    const huge = invoice({
      contact_id: "big-cust",
      total: 50_000,
      subtotal: 50_000,
      vat_total: 11_500,
    })
    const result = detectAnomalies({
      invoices: [...normal, huge],
      expenses: [],
    })
    const outliers = result.filter((a) => a.kind === "outlier")
    expect(outliers.some((a) => a.entityId === huge.id)).toBe(true)
  })

  it("flags a suspicious VAT rate on an expense", () => {
    const result = detectAnomalies({
      invoices: [],
      expenses: [
        expense({
          document_number: "VAT-1",
          vat_rate_breakdown: [{ rate: 17, base: 100, vat: 17 }],
        }),
      ],
    })
    const vat = result.filter((a) => a.kind === "vat")
    expect(vat).toHaveLength(1)
    expect(vat[0].message).toContain("17")
  })

  it("flags a missing counterpart", () => {
    const result = detectAnomalies({
      invoices: [invoice({ contact_id: null })],
      expenses: [],
    })
    expect(result.some((a) => a.kind === "missing")).toBe(true)
  })
})
