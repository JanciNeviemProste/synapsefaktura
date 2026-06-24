import { describe, it, expect } from "vitest"
import { matchTransaction, statusFromPaid } from "./match"

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

describe("statusFromPaid", () => {
  it("maps paid amount to status", () => {
    expect(statusFromPaid(246, 0)).toBe("unpaid")
    expect(statusFromPaid(246, 100)).toBe("partially_paid")
    expect(statusFromPaid(246, 246)).toBe("paid")
    expect(statusFromPaid(246, 300)).toBe("paid")
  })
})
