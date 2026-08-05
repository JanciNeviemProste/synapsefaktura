import { describe, it, expect } from "vitest"
import { deriveVatRate } from "@/lib/expenses/vat-rate"

describe("deriveVatRate", () => {
  it("odvodí bežné slovenské sadzby", () => {
    expect(deriveVatRate(100, 23)).toBe(23)
    expect(deriveVatRate(100, 19)).toBe(19)
    expect(deriveVatRate(100, 5)).toBe(5)
  })

  it("zvládne zaokrúhlenie po halieroch", () => {
    // Bloček: základ 33,33 a DPH 7,67 dáva 23,01 % — stále 23 %.
    expect(deriveVatRate(33.33, 7.67)).toBe(23)
    expect(deriveVatRate(12.61, 2.4)).toBe(19)
  })

  it("NEZAMENÍ 19 % za 23 %", () => {
    // Presne ta chyba, kvoli ktorej tato funkcia vznikla: potravinovy blocek
    // dostaval natvrdo 23 %.
    expect(deriveVatRate(100, 19)).not.toBe(23)
  })

  it("vráti 0, keď sumy sadzbu nedávajú", () => {
    // 15 % na Slovensku neexistuje — radsej „neviem" nez tichy odhad.
    expect(deriveVatRate(100, 15)).toBe(0)
    expect(deriveVatRate(100, 30)).toBe(0)
  })

  it("vráti 0 pri chýbajúcej alebo nulovej dani", () => {
    expect(deriveVatRate(100, null)).toBe(0)
    expect(deriveVatRate(100, undefined)).toBe(0)
    expect(deriveVatRate(100, 0)).toBe(0)
  })

  it("vráti 0 pri nezmyselnom základe", () => {
    expect(deriveVatRate(0, 23)).toBe(0)
    expect(deriveVatRate(-100, 23)).toBe(0)
    expect(deriveVatRate(Number.NaN, 23)).toBe(0)
    expect(deriveVatRate(100, Number.NaN)).toBe(0)
  })

  it("nikdy nevráti sadzbu mimo platných", () => {
    // Nahodne sumy nesmu vyrobit napr. 21 % alebo 17 %.
    for (let base = 1; base <= 200; base += 7) {
      for (let vat = 0; vat <= base; vat += 3) {
        const r = deriveVatRate(base, vat)
        expect([23, 19, 5, 0]).toContain(r)
      }
    }
  })
})
