import { describe, it, expect } from "vitest"
import {
  cashBalance,
  cashBalancesByRegister,
  cashTotals,
  type CashEntry,
} from "./balance"

const income = (amount: number): CashEntry => ({ direction: "in", amount })
const expense = (amount: number): CashEntry => ({ direction: "out", amount })

describe("cashTotals", () => {
  it("scita prijmove doklady", () => {
    expect(cashTotals([income(100), income(25.5)])).toEqual({
      income: 125.5,
      expense: 0,
      balance: 125.5,
      count: 2,
    })
  })

  it("scita vydavkove doklady ako kladne cislo a odpocita ich", () => {
    expect(cashTotals([income(200), expense(50), expense(19.99)])).toEqual({
      income: 200,
      expense: 69.99,
      balance: 130.01,
      count: 3,
    })
  })

  it("ignoruje nulove, zaporne a neciselne sumy", () => {
    expect(
      cashTotals([income(10), income(0), expense(-5), income(NaN)]),
    ).toEqual({ income: 10, expense: 0, balance: 10, count: 1 })
  })

  it("zaokruhluje na centy, nie na float artefakty", () => {
    expect(cashTotals([income(0.1), income(0.2)]).balance).toBe(0.3)
  })
})

describe("cashBalance", () => {
  it("prazdna pokladna ma nulovy zostatok", () => {
    expect(cashBalance([])).toBe(0)
  })

  it("vrati zostatok z prijmov", () => {
    expect(cashBalance([income(50), income(50)])).toBe(100)
  })

  it("vrati zaporny zostatok, ked vydaje prevysia prijmy", () => {
    // V praxi je to chyba (vydaj bez zaevidovaneho prijmu), ale funkcia ho ma
    // vratit tak ako vysiel — UI na neho ma upozornit, nie ho schovat.
    expect(cashBalance([income(20), expense(75.5)])).toBe(-55.5)
  })

  it("samotny vydaj bez prijmu je zaporny", () => {
    expect(cashBalance([expense(12.34)])).toBe(-12.34)
  })
})

describe("cashBalancesByRegister", () => {
  it("rata kazdu pokladnu zvlast", () => {
    const items = [
      { ...income(100), cash_register_id: "a" },
      { ...expense(40), cash_register_id: "a" },
      { ...expense(10), cash_register_id: "b" },
    ]
    expect(cashBalancesByRegister(items)).toEqual({ a: 60, b: -10 })
  })

  it("pokladna bez dokladov v zozname nie je v mape", () => {
    expect(cashBalancesByRegister([])).toEqual({})
  })
})
