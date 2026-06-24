import { describe, expect, it } from "vitest"
import type { UblInvoiceModel } from "./types"
import { validateUbl } from "./validate"

/** A fully valid `payer` invoice used as the baseline for mutation in tests. */
function validPayerInvoice(): UblInvoiceModel {
  return {
    number: "2026001",
    issueDate: "2026-06-25",
    dueDate: "2026-07-09",
    currency: "EUR",
    vatMode: "payer",
    note: null,
    seller: {
      name: "Synapse s.r.o.",
      peppolId: "0245:2020317068",
      vatId: "SK2020317068",
      companyId: "12345678",
      country: "SK",
    },
    buyer: {
      name: "Odberateľ a.s.",
      peppolId: "0245:36000001",
      vatId: "SK1234567890",
      country: "SK",
    },
    lines: [
      {
        position: 1,
        description: "Konzultácia",
        quantity: 10,
        unit: "h",
        unitPrice: 100,
        vatRate: 23,
        lineNet: 1000,
        taxCategory: "S",
      },
    ],
    taxSubtotals: [{ rate: 23, base: 1000, vat: 230, category: "S" }],
    subtotal: 1000,
    vatTotal: 230,
    total: 1230,
  }
}

const errorRules = (m: UblInvoiceModel) =>
  validateUbl(m)
    .errors.filter((e) => e.severity === "error")
    .map((e) => e.rule)

const allRules = (m: UblInvoiceModel) =>
  validateUbl(m).errors.map((e) => e.rule)

describe("validateUbl", () => {
  it("accepts a fully valid payer invoice", () => {
    const result = validateUbl(validPayerInvoice())
    expect(result.valid).toBe(true)
    expect(result.errors.filter((e) => e.severity === "error")).toEqual([])
  })

  it("flags a missing invoice number with BR-02", () => {
    const m = validPayerInvoice()
    m.number = ""
    const result = validateUbl(m)
    expect(result.valid).toBe(false)
    expect(errorRules(m)).toContain("BR-02")
  })

  it("flags subtotal not matching the line sum with BR-CO-10", () => {
    const m = validPayerInvoice()
    m.subtotal = 999 // line sum is 1000
    expect(errorRules(m)).toContain("BR-CO-10")
  })

  it("flags total != subtotal + vatTotal with BR-CO-13", () => {
    const m = validPayerInvoice()
    m.total = 1300 // should be 1230
    expect(errorRules(m)).toContain("BR-CO-13")
  })

  it("flags reverse_charge_domestic with non-zero VAT total (AE error)", () => {
    const m = validPayerInvoice()
    m.vatMode = "reverse_charge_domestic"
    // buyer has vatId, but VAT total is non-zero
    const rules = errorRules(m)
    expect(rules).toContain("BR-AE-08")
    expect(validateUbl(m).valid).toBe(false)
  })

  it("flags reverse_charge_domestic with missing buyer vatId (AE error)", () => {
    const m = validPayerInvoice()
    m.vatMode = "reverse_charge_domestic"
    m.vatTotal = 0
    m.total = 1000
    m.taxSubtotals = [{ rate: 0, base: 1000, vat: 0, category: "AE" }]
    m.buyer.vatId = null
    expect(errorRules(m)).toContain("BR-AE-09")
  })

  it("keeps a payer invoice valid but warns when buyer peppolId is missing", () => {
    const m = validPayerInvoice()
    m.buyer.peppolId = null
    const result = validateUbl(m)
    expect(result.valid).toBe(true)
    expect(
      result.errors.find((e) => e.rule === "PEPPOL-EN16931-R010")?.severity,
    ).toBe("warning")
    expect(allRules(m)).toContain("PEPPOL-EN16931-R010")
  })
})
