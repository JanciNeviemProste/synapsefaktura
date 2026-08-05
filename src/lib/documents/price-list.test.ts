import { describe, it, expect } from "vitest"
import { newPriceListEntries } from "@/lib/documents/price-list"

const item = (p: Partial<Parameters<typeof newPriceListEntries>[0][number]>) => ({
  description: "Konzultácie",
  unit: "h",
  unitPrice: 50,
  vatRate: 23,
  ...p,
})

describe("newPriceListEntries", () => {
  it("pridá položku, ktorá v cenníku ešte nie je", () => {
    expect(newPriceListEntries([item({})], [])).toEqual([
      { name: "Konzultácie", unit: "h", unit_price: 50, vat_rate: 23 },
    ])
  })

  it("nepridá to, čo v cenníku už je", () => {
    expect(newPriceListEntries([item({})], ["Konzultácie"])).toEqual([])
  })

  it("zhoda názvu nezáleží na veľkosti písmen ani medzerách", () => {
    // Bez toho by sa cennik po par dokladoch zaplnil variantmi tej istej veci.
    expect(
      newPriceListEntries([item({ description: "  konzultácie  " })], [
        "Konzultácie",
      ]),
    ).toEqual([])
    expect(
      newPriceListEntries([item({ description: "Doprava   Bratislava" })], [
        "doprava bratislava",
      ]),
    ).toEqual([])
  })

  it("dva rovnaké riadky v jednom doklade pridajú jednu položku", () => {
    const r = newPriceListEntries([item({}), item({})], [])
    expect(r).toHaveLength(1)
  })

  it("preskočí položku bez popisu", () => {
    expect(newPriceListEntries([item({ description: "   " })], [])).toEqual([])
  })

  it("preskočí položku s nulovou alebo zápornou cenou", () => {
    // Bezne medzisucet alebo poznamka v riadku — do cennika nepatri.
    expect(newPriceListEntries([item({ unitPrice: 0 })], [])).toEqual([])
    expect(newPriceListEntries([item({ unitPrice: -5 })], [])).toEqual([])
  })

  it("preskočí nezmyselnú cenu", () => {
    expect(newPriceListEntries([item({ unitPrice: Number.NaN })], [])).toEqual([])
  })

  it("prázdna MJ sa doplní na 'ks'", () => {
    expect(newPriceListEntries([item({ unit: "" })], [])[0].unit).toBe("ks")
  })

  it("uloží popis tak, ako ho používateľ napísal", () => {
    // Porovnava sa normalizovane, ULOZI sa povodny tvar.
    const r = newPriceListEntries([item({ description: "  Grafické práce " })], [])
    expect(r[0].name).toBe("Grafické práce")
  })

  it("zachová sadzbu DPH aj cenu z dokladu", () => {
    const r = newPriceListEntries(
      [item({ description: "Kniha", unitPrice: 12.5, vatRate: 5 })],
      [],
    )
    expect(r[0]).toMatchObject({ unit_price: 12.5, vat_rate: 5 })
  })
})
