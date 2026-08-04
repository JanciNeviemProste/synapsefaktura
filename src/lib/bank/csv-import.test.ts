import { describe, it, expect } from "vitest"
import {
  parseBankCsv,
  parseAmount,
  parseDate,
  transactionKey,
  isDuplicateTransaction,
  shouldAutoBook,
} from "./csv-import"

describe("parseAmount", () => {
  it("parses SK and intl formats", () => {
    expect(parseAmount("1 234,56")).toBe(1234.56)
    expect(parseAmount("-1234.56")).toBe(-1234.56)
    expect(parseAmount("1,234.56")).toBe(1234.56)
    expect(parseAmount("246,00 €")).toBe(246)
    expect(parseAmount("100")).toBe(100)
  })
})

describe("parseDate", () => {
  it("normalizes dd.mm.yyyy and iso", () => {
    expect(parseDate("08.07.2026")).toBe("2026-07-08")
    expect(parseDate("2026-07-08")).toBe("2026-07-08")
    expect(parseDate("8. 7. 2026")).toBe("2026-07-08")
    expect(parseDate("nonsense")).toBeNull()
  })
})

describe("parseBankCsv", () => {
  it("parses a semicolon CSV with SK headers", () => {
    const csv = [
      "Dátum;Suma;Variabilný symbol;Protistrana;Správa",
      "08.07.2026;246,00;20260001;Tibor Ozančin s.r.o.;Platba faktury",
      "09.07.2026;-50,00;;Kancelária;Nákup",
    ].join("\n")
    const { transactions, errors } = parseBankCsv(csv)
    expect(errors).toHaveLength(0)
    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toMatchObject({
      bookedAt: "2026-07-08",
      amount: 246,
      vs: "20260001",
      counterparty: "Tibor Ozančin s.r.o.",
    })
    expect(transactions[1].amount).toBe(-50)
    expect(transactions[1].vs).toBeNull()
  })

  it("handles quoted fields and comma delimiter", () => {
    const csv = [
      "date,amount,vs,message",
      '2026-07-08,"1,234.56",555,"Hello, world"',
    ].join("\n")
    const { transactions } = parseBankCsv(csv)
    expect(transactions[0].amount).toBe(1234.56)
    expect(transactions[0].message).toBe("Hello, world")
  })

  it("reports a missing amount column", () => {
    const { errors } = parseBankCsv("dátum;poznámka\n08.07.2026;test")
    expect(errors.length).toBeGreaterThan(0)
  })
})

const tx = {
  bookedAt: "2026-07-08",
  amount: 246,
  vs: "20260001",
  counterparty: "Tibor Ozančin s.r.o.",
}

describe("transactionKey", () => {
  it("normalizes the amount to two decimals", () => {
    expect(transactionKey({ ...tx, amount: 246 })).toBe(
      transactionKey({ ...tx, amount: 246.0 }),
    )
  })

  it("ignores case and extra whitespace in text parts", () => {
    expect(
      transactionKey({ ...tx, counterparty: "  TIBOR  ozančin s.r.o. " }),
    ).toBe(transactionKey({ ...tx, counterparty: "Tibor Ozančin s.r.o." }))
  })

  it("treats null and empty string the same", () => {
    expect(transactionKey({ ...tx, vs: null })).toBe(
      transactionKey({ ...tx, vs: "  " }),
    )
  })

  it("differs when any part of the combination differs", () => {
    const base = transactionKey(tx)
    expect(transactionKey({ ...tx, amount: 246.5 })).not.toBe(base)
    expect(transactionKey({ ...tx, bookedAt: "2026-07-09" })).not.toBe(base)
    expect(transactionKey({ ...tx, vs: "20260002" })).not.toBe(base)
    expect(transactionKey({ ...tx, counterparty: "Iná firma" })).not.toBe(base)
  })
})

describe("isDuplicateTransaction", () => {
  const seen = new Set([transactionKey(tx)])

  it("detects a re-imported row", () => {
    expect(isDuplicateTransaction({ ...tx }, seen)).toBe(true)
  })

  it("lets a different amount through", () => {
    expect(isDuplicateTransaction({ ...tx, amount: 100 }, seen)).toBe(false)
  })

  it("lets a different date through", () => {
    expect(isDuplicateTransaction({ ...tx, bookedAt: "2026-07-09" }, seen)).toBe(
      false,
    )
  })

  it("returns false against an empty set", () => {
    expect(isDuplicateTransaction(tx, new Set())).toBe(false)
  })
})

describe("shouldAutoBook", () => {
  it("books an exact VS + amount match", () => {
    expect(shouldAutoBook({ documentId: "a", confidence: "vs_amount" })).toBe(
      true,
    )
  })

  it("books a unique exact amount match", () => {
    expect(shouldAutoBook({ documentId: "a", confidence: "amount" })).toBe(true)
  })

  it("does NOT book a VS match with a different amount", () => {
    expect(shouldAutoBook({ documentId: "a", confidence: "vs" })).toBe(false)
  })

  it("does not book without a document", () => {
    expect(shouldAutoBook({ documentId: null, confidence: "none" })).toBe(false)
    expect(shouldAutoBook({ documentId: null, confidence: "vs_amount" })).toBe(
      false,
    )
  })
})
