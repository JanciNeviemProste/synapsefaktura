import { describe, it, expect } from "vitest"
import { computeExpenseItems } from "@/lib/expenses/items"

describe("computeExpenseItems", () => {
  it("zvladne dodavatelsku fakturu s viacerymi sadzbami DPH", () => {
    // Presne ten pripad, ktory sa doteraz nedal zadat spravne.
    const r = computeExpenseItems([
      { description: "Materiál", quantity: 2, unit: "ks", unitPrice: 100, vatRate: 23 },
      { description: "Kniha", quantity: 1, unit: "ks", unitPrice: 50, vatRate: 5 },
    ])

    expect(r.subtotal).toBe(250)
    expect(r.vat_total).toBe(48.5) // 46,00 + 2,50
    expect(r.total).toBe(298.5)

    expect(r.vat_rate_breakdown).toEqual([
      { rate: 23, base: 200, vat: 46 },
      { rate: 5, base: 50, vat: 2.5 },
    ])
  })

  it("rekapitulacia zluci riadky s rovnakou sadzbou", () => {
    const r = computeExpenseItems([
      { description: "A", quantity: 1, unit: "ks", unitPrice: 100, vatRate: 23 },
      { description: "B", quantity: 1, unit: "ks", unitPrice: 200, vatRate: 23 },
    ])
    expect(r.vat_rate_breakdown).toEqual([{ rate: 23, base: 300, vat: 69 }])
  })

  it("polozky dostanu poradie a dopocitane sumy", () => {
    const r = computeExpenseItems([
      { description: "Prvá", quantity: 3, unit: "h", unitPrice: 10, vatRate: 23 },
    ])
    expect(r.items).toEqual([
      {
        position: 0,
        description: "Prvá",
        quantity: 3,
        unit: "h",
        unit_price: 10,
        vat_rate: 23,
        line_base: 30,
        line_vat: 6.9,
        line_total: 36.9,
      },
    ])
  })

  it("nulova sadzba prejde ako platna — dodavatel DPH neuctoval", () => {
    const r = computeExpenseItems([
      { description: "Od neplatiteľa", quantity: 1, unit: "ks", unitPrice: 80, vatRate: 0 },
    ])
    expect(r.subtotal).toBe(80)
    expect(r.vat_total).toBe(0)
    expect(r.total).toBe(80)
    expect(r.vat_rate_breakdown).toEqual([{ rate: 0, base: 80, vat: 0 }])
  })

  it("prazdny zoznam da nuly, nie NaN", () => {
    const r = computeExpenseItems([])
    expect(r).toMatchObject({ subtotal: 0, vat_total: 0, total: 0 })
    expect(r.items).toEqual([])
    expect(r.vat_rate_breakdown).toEqual([])
  })

  it("sucet sedi na cent aj pri zaokruhlovani po riadkoch", () => {
    // 3 x 33,33 pri 23 % — po riadkoch, nie z celku, aby DPH nedriftovala.
    const r = computeExpenseItems([
      { description: "A", quantity: 1, unit: "ks", unitPrice: 33.33, vatRate: 23 },
      { description: "B", quantity: 1, unit: "ks", unitPrice: 33.33, vatRate: 23 },
      { description: "C", quantity: 1, unit: "ks", unitPrice: 33.33, vatRate: 23 },
    ])
    expect(r.subtotal).toBe(99.99)
    expect(r.vat_total).toBe(23.01) // 7,67 x 3
    expect(r.total).toBe(123)
    // Rekapitulacia musi sediet so sumarom do centa.
    const recapBase = r.vat_rate_breakdown.reduce((s, x) => s + x.base, 0)
    const recapVat = r.vat_rate_breakdown.reduce((s, x) => s + x.vat, 0)
    expect(recapBase).toBeCloseTo(r.subtotal, 2)
    expect(recapVat).toBeCloseTo(r.vat_total, 2)
  })
})
