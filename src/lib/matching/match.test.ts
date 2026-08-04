import { describe, it, expect } from "vitest"
import {
  matchTransaction,
  matchExpenseTransaction,
  statusFromPaid,
} from "./match"

const docs = [
  { id: "a", number: "20260001", total: 246, paidAmount: 0 },
  { id: "b", number: "20260002", total: 100, paidAmount: 0 },
  { id: "c", number: "20260003", total: 246, paidAmount: 0 },
]

describe("matchTransaction", () => {
  it("matches by VS + amount (high confidence)", () => {
    const r = matchTransaction({ amount: 246, vs: "20260001" }, docs)
    expect(r).toEqual({ documentId: "a", confidence: "vs_amount" })
  })

  it("matches by VS even if amount differs (partial)", () => {
    const r = matchTransaction({ amount: 100, vs: "20260001" }, docs)
    expect(r).toEqual({ documentId: "a", confidence: "vs" })
  })

  it("falls back to a unique amount when VS is missing", () => {
    const r = matchTransaction({ amount: 100, vs: null }, docs)
    expect(r).toEqual({ documentId: "b", confidence: "amount" })
  })

  it("returns none when amount is ambiguous and no VS", () => {
    const r = matchTransaction({ amount: 246, vs: null }, docs)
    expect(r.documentId).toBeNull()
    expect(r.confidence).toBe("none")
  })

  it("ignores outgoing (negative) payments", () => {
    const r = matchTransaction({ amount: -246, vs: "20260001" }, docs)
    expect(r.confidence).toBe("none")
  })

  it("respects already-paid amount when matching by amount", () => {
    const partial = [
      { id: "x", number: "20260009", total: 246, paidAmount: 146 },
    ]
    const r = matchTransaction({ amount: 100, vs: null }, partial)
    expect(r).toEqual({ documentId: "x", confidence: "amount" })
  })
})

const expenses = [
  { id: "e1", documentNumber: "FA-2026-0077", total: 120, paidAmount: 0 },
  { id: "e2", documentNumber: "FA-2026-0078", total: 50, paidAmount: 0 },
  { id: "e3", documentNumber: null, total: 120, paidAmount: 0 },
]

describe("matchExpenseTransaction", () => {
  it("matches an outgoing payment by VS + amount", () => {
    const r = matchExpenseTransaction({ amount: -120, vs: "20260077" }, [
      expenses[0],
    ])
    expect(r).toEqual({ expenseId: "e1", confidence: "vs_amount" })
  })

  it("matches by VS even if the amount differs (partial)", () => {
    const r = matchExpenseTransaction({ amount: -20, vs: "202600 77" }, [
      expenses[0],
    ])
    expect(r).toEqual({ expenseId: "e1", confidence: "vs" })
  })

  it("falls back to a unique outstanding amount when VS is missing", () => {
    const r = matchExpenseTransaction({ amount: -50, vs: null }, expenses)
    expect(r).toEqual({ expenseId: "e2", confidence: "amount" })
  })

  it("returns none when the amount is ambiguous and there is no VS", () => {
    const r = matchExpenseTransaction({ amount: -120, vs: null }, expenses)
    expect(r).toEqual({ expenseId: null, confidence: "none" })
  })

  it("settles the remainder, not the total, of a partially paid expense", () => {
    const partial = [
      { id: "p", documentNumber: "FA-9", total: 120, paidAmount: 100 },
    ]
    const r = matchExpenseTransaction({ amount: -20, vs: null }, partial)
    expect(r).toEqual({ expenseId: "p", confidence: "amount" })
  })

  it("ignores incoming (positive) payments", () => {
    const r = matchExpenseTransaction({ amount: 120, vs: "20260077" }, expenses)
    expect(r).toEqual({ expenseId: null, confidence: "none" })
  })

  it("ignores a zero amount", () => {
    const r = matchExpenseTransaction({ amount: 0, vs: "20260077" }, expenses)
    expect(r.expenseId).toBeNull()
  })

  it("never matches an expense without a document number by VS alone", () => {
    const r = matchExpenseTransaction({ amount: -999, vs: "20260077" }, [
      expenses[2],
    ])
    expect(r).toEqual({ expenseId: null, confidence: "none" })
  })
})

describe("statusFromPaid", () => {
  it("maps paid amount to status", () => {
    expect(statusFromPaid(246, 0)).toBe("unpaid")
    expect(statusFromPaid(246, 100)).toBe("partially_paid")
    expect(statusFromPaid(246, 246)).toBe("paid")
    expect(statusFromPaid(246, 300)).toBe("paid")
  })
})
