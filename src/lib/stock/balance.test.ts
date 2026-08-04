import { describe, expect, it } from "vitest"

import {
  applyStockMovement,
  sortStockMovements,
  stockBalance,
  stockBalanceHistory,
  type StockMovementEntry,
} from "./balance"

/** Skratka: pohyb s volitelnym datumom, aby testy neboli zaplavene poliami. */
function mv(
  type: StockMovementEntry["type"],
  quantity: StockMovementEntry["quantity"],
  moved_at?: string,
): StockMovementEntry {
  return { type, quantity, moved_at }
}

describe("applyStockMovement", () => {
  it("prijem pripocita", () => {
    expect(applyStockMovement(10, mv("in", 5))).toBe(15)
  })

  it("vydaj odpocita", () => {
    expect(applyStockMovement(10, mv("out", 4))).toBe(6)
  })

  it("vratka pripocita rovnako ako prijem", () => {
    expect(applyStockMovement(10, mv("return", 2))).toBe(12)
  })

  it("oprava prepise stav, nepripocitava sa", () => {
    expect(applyStockMovement(10, mv("adjustment", 3))).toBe(3)
  })

  it("znamienko mnozstva sa ignoruje — smer urcuje typ", () => {
    expect(applyStockMovement(10, mv("in", -5))).toBe(15)
    expect(applyStockMovement(10, mv("out", -5))).toBe(5)
  })

  it("neznamy typ stav nemeni", () => {
    const unknown = {
      type: "scrap",
      quantity: 5,
    } as unknown as StockMovementEntry
    expect(applyStockMovement(10, unknown)).toBe(10)
  })
})

describe("stockBalance", () => {
  it("bez pohybov je stav nula", () => {
    expect(stockBalance([])).toBe(0)
  })

  it("samotny prijem", () => {
    expect(stockBalance([mv("in", 10)])).toBe(10)
  })

  it("samotny vydaj ide do minusu", () => {
    expect(stockBalance([mv("out", 3)])).toBe(-3)
  })

  it("kombinacia prijem + vydaj", () => {
    expect(stockBalance([mv("in", 10), mv("out", 4)])).toBe(6)
  })

  it("kombinacia prijem + vydaj + vratka", () => {
    expect(stockBalance([mv("in", 10), mv("out", 4), mv("return", 1)])).toBe(7)
  })

  it("oprava vynuluje historiu pred nou a dalsie pohyby na nu nadviazu", () => {
    expect(
      stockBalance([
        mv("in", 100, "2026-01-01T00:00:00.000Z"),
        mv("out", 30, "2026-01-02T00:00:00.000Z"),
        // inventura zistila 50 ks, nie 70 — evidencia bola zla
        mv("adjustment", 50, "2026-01-03T00:00:00.000Z"),
        mv("out", 5, "2026-01-04T00:00:00.000Z"),
      ]),
    ).toBe(45)
  })

  it("vysledok moze byt zaporny, ked sa vydalo viac nez je na sklade", () => {
    expect(stockBalance([mv("in", 5), mv("out", 8)])).toBe(-3)
  })

  it("zaporny stav sa da vratkou dostat spat do plusu", () => {
    expect(stockBalance([mv("in", 5), mv("out", 8), mv("return", 4)])).toBe(1)
  })

  it("numeric z Postgresu moze prist ako retazec", () => {
    expect(stockBalance([mv("in", "10.5"), mv("out", "0.5")])).toBe(10)
  })

  it("nepouzitelne mnozstvo (null, NaN) sa berie ako nula", () => {
    expect(
      stockBalance([mv("in", 10), mv("out", null), mv("in", "cosi")]),
    ).toBe(10)
  })

  it("desatinne mnozstva nezanechaju plavajuci zvysok", () => {
    expect(stockBalance([mv("in", 0.1), mv("in", 0.2)])).toBe(0.3)
    expect(stockBalance([mv("in", 1), mv("out", 0.999)])).toBe(0.001)
  })

  it("na poradi zaznamov v poli nezalezi, na case ano", () => {
    const chronological = [
      mv("adjustment", 50, "2026-01-01T00:00:00.000Z"),
      mv("in", 10, "2026-02-01T00:00:00.000Z"),
    ]
    const shuffled = [chronological[1], chronological[0]]
    expect(stockBalance(shuffled)).toBe(stockBalance(chronological))
    expect(stockBalance(shuffled)).toBe(60)
  })

  it("neskorsia oprava prebije skorsi prijem bez ohladu na poradie v poli", () => {
    expect(
      stockBalance([
        mv("in", 10, "2026-01-01T00:00:00.000Z"),
        mv("adjustment", 4, "2026-03-01T00:00:00.000Z"),
        mv("in", 1, "2026-02-01T00:00:00.000Z"),
      ]),
    ).toBe(4)
  })
})

describe("sortStockMovements", () => {
  it("radi podla moved_at vzostupne", () => {
    const sorted = sortStockMovements([
      mv("in", 1, "2026-03-01T00:00:00.000Z"),
      mv("in", 2, "2026-01-01T00:00:00.000Z"),
      mv("in", 3, "2026-02-01T00:00:00.000Z"),
    ])
    expect(sorted.map((m) => m.quantity)).toEqual([2, 3, 1])
  })

  it("pri zhodnom moved_at rozhoduje created_at", () => {
    const sorted = sortStockMovements([
      {
        type: "in",
        quantity: 1,
        moved_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-05T00:00:00.000Z",
      },
      {
        type: "in",
        quantity: 2,
        moved_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ])
    expect(sorted.map((m) => m.quantity)).toEqual([2, 1])
  })

  it("pri uplnej zhode zachova povodne poradie a nemeni vstupne pole", () => {
    const input = [mv("in", 1), mv("out", 2), mv("in", 3)]
    const sorted = sortStockMovements(input)
    expect(sorted.map((m) => m.quantity)).toEqual([1, 2, 3])
    expect(input.map((m) => m.quantity)).toEqual([1, 2, 3])
  })
})

describe("stockBalanceHistory", () => {
  it("vracia stav po kazdom pohybe v chronologickom poradi", () => {
    const history = stockBalanceHistory([
      mv("out", 4, "2026-01-02T00:00:00.000Z"),
      mv("in", 10, "2026-01-01T00:00:00.000Z"),
      mv("return", 1, "2026-01-03T00:00:00.000Z"),
    ])
    expect(history.map((h) => h.balance)).toEqual([10, 6, 7])
  })

  it("posledny stav sa zhoduje so stockBalance", () => {
    const movements = [
      mv("in", 7, "2026-01-01T00:00:00.000Z"),
      mv("adjustment", 5, "2026-01-02T00:00:00.000Z"),
      mv("out", 9, "2026-01-03T00:00:00.000Z"),
    ]
    const history = stockBalanceHistory(movements)
    expect(history[history.length - 1].balance).toBe(stockBalance(movements))
    expect(stockBalance(movements)).toBe(-4)
  })

  it("prazdny zoznam da prazdnu historiu", () => {
    expect(stockBalanceHistory([])).toEqual([])
  })
})
