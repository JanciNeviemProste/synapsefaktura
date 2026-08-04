import { describe, it, expect } from "vitest"

import {
  deductibleBusinessFuel,
  deductibleFuel,
  normedFuelLitres,
  travelReimbursement,
} from "./consumption"

describe("deductibleBusinessFuel", () => {
  it("rozdelí strop pomerom služobných km — nie naopak", () => {
    // 6 l/100 km, 1000 km služobne + 1000 súkromne, natankovaných 70 l.
    // Fyzika: 2000 km si vyžiada 120 l, doložených je len 70 → strop 70 l.
    // Daň: služobná je polovica jázd → uznateľných 35 l.
    const res = deductibleBusinessFuel({
      totalKm: 2000,
      businessKm: 1000,
      consumption: 6,
      purchasedLitres: 70,
    })
    expect(res?.normedLitres).toBe(120)
    expect(res?.eligibleLitres).toBe(70)
    expect(res?.businessShare).toBe(0.5)
    expect(res?.litres).toBe(35)
    // Rozhoduje nedostatok dokladov, nie normovaná spotreba.
    expect(res?.basis).toBe("purchased")
  })

  it("bez súkromných jázd sa strop nedelí", () => {
    const res = deductibleBusinessFuel({
      totalKm: 2400,
      businessKm: 2400,
      consumption: 5.8,
      purchasedLitres: 90,
    })
    expect(res?.normedLitres).toBe(139.2)
    expect(res?.businessShare).toBe(1)
    expect(res?.litres).toBe(90)
  })

  it("keď rozhoduje normovaná spotreba, delí sa tá", () => {
    // 1000 km spolu (800 služobne), 5 l/100 = 50 l normovane, natankovaných 80.
    const res = deductibleBusinessFuel({
      totalKm: 1000,
      businessKm: 800,
      consumption: 5,
      purchasedLitres: 80,
    })
    expect(res?.basis).toBe("normed")
    expect(res?.eligibleLitres).toBe(50)
    expect(res?.litres).toBe(40)
  })

  it("žiadne jazdy → nulový podiel, nie delenie nulou", () => {
    const res = deductibleBusinessFuel({
      totalKm: 0,
      businessKm: 0,
      consumption: 6,
      purchasedLitres: 40,
    })
    expect(res?.businessShare).toBe(0)
    expect(res?.litres).toBe(0)
  })

  it("služobné km nad rámec celkových sa orežú — odpočet sa nenafúkne", () => {
    const res = deductibleBusinessFuel({
      totalKm: 100,
      businessKm: 500,
      consumption: 6,
      purchasedLitres: 10,
    })
    expect(res?.businessShare).toBe(1)
    expect(res?.litres).toBe(res?.eligibleLitres)
  })

  it("chýbajúca spotreba vráti null aj tu", () => {
    expect(
      deductibleBusinessFuel({
        totalKm: 1000,
        businessKm: 500,
        consumption: null,
        purchasedLitres: 60,
      }),
    ).toBeNull()
  })
})

describe("normedFuelLitres", () => {
  it("počíta normovanú spotrebu z km a spotreby na 100 km", () => {
    expect(normedFuelLitres(1000, 6.5)).toBe(65)
    expect(normedFuelLitres(237, 7.4)).toBe(17.54)
  })

  it("nula km je nula litrov", () => {
    expect(normedFuelLitres(0, 6.5)).toBe(0)
  })

  it("chýbajúca spotreba vráti null, nie 0", () => {
    expect(normedFuelLitres(1000, null)).toBeNull()
    expect(normedFuelLitres(1000, undefined)).toBeNull()
  })

  it("odmietne nezmyselné vstupy", () => {
    expect(normedFuelLitres(-10, 6.5)).toBeNull()
    expect(normedFuelLitres(1000, -6.5)).toBeNull()
    expect(normedFuelLitres(Number.NaN, 6.5)).toBeNull()
  })
})

describe("deductibleFuel", () => {
  it("normovaná < nakúpená → uzná sa normovaná", () => {
    const res = deductibleFuel({
      km: 1000,
      consumption: 6.5,
      purchasedLitres: 80,
    })
    expect(res).toEqual({
      litres: 65,
      normedLitres: 65,
      purchasedLitres: 80,
      basis: "normed",
      difference: 15,
    })
  })

  it("normovaná > nakúpená → uzná sa nakúpená", () => {
    const res = deductibleFuel({
      km: 1000,
      consumption: 9,
      purchasedLitres: 70,
    })
    expect(res).toEqual({
      litres: 70,
      normedLitres: 90,
      purchasedLitres: 70,
      basis: "purchased",
      difference: 20,
    })
  })

  it("rovnosť → nulový rozdiel a basis 'equal'", () => {
    const res = deductibleFuel({
      km: 1000,
      consumption: 6.5,
      purchasedLitres: 65,
    })
    expect(res?.basis).toBe("equal")
    expect(res?.litres).toBe(65)
    expect(res?.difference).toBe(0)
  })

  it("nula km → uznateľné je nič, lebo sa nikam nešlo", () => {
    const res = deductibleFuel({ km: 0, consumption: 6.5, purchasedLitres: 40 })
    expect(res?.litres).toBe(0)
    expect(res?.basis).toBe("normed")
    expect(res?.difference).toBe(40)
  })

  it("chýbajúca spotreba vráti null — 0 by tvrdila, že nič nie je uznateľné", () => {
    expect(
      deductibleFuel({ km: 1000, consumption: null, purchasedLitres: 80 }),
    ).toBeNull()
  })

  it("zaokrúhlenie nerozbije rovnosť", () => {
    // 3 x 33.33 km pri 3 l/100 km = 2.9997 l; zaokruhlene 3.00 = nakupene 3.00
    const res = deductibleFuel({
      km: 99.99,
      consumption: 3,
      purchasedLitres: 3,
    })
    expect(res?.basis).toBe("equal")
    expect(res?.difference).toBe(0)
  })
})

describe("travelReimbursement", () => {
  it("sčíta základnú náhradu za km a náhradu za palivo", () => {
    expect(
      travelReimbursement({ km: 120, ratePerKm: 0.264, fuelCost: 14.5 }),
    ).toEqual({ basicAmount: 31.68, fuelAmount: 14.5, total: 46.18 })
  })

  it("bez nákladu na palivo je náhrada len za km", () => {
    expect(travelReimbursement({ km: 100, ratePerKm: 0.264 })).toEqual({
      basicAmount: 26.4,
      fuelAmount: 0,
      total: 26.4,
    })
  })

  it("nula km je nulová náhrada", () => {
    expect(travelReimbursement({ km: 0, ratePerKm: 0.264 })?.total).toBe(0)
  })

  it("odmietne záporné km alebo sadzbu", () => {
    expect(travelReimbursement({ km: -1, ratePerKm: 0.264 })).toBeNull()
    expect(travelReimbursement({ km: 10, ratePerKm: -0.264 })).toBeNull()
  })
})
