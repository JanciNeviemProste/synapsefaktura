import { describe, it, expect } from "vitest"
import { round, round2, formatMoney } from "./money"

describe("round / round2", () => {
  it("rounds half-up to 2 decimals", () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.675)).toBe(2.68)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it("handles plain values", () => {
    expect(round2(100)).toBe(100)
    expect(round2(29.97)).toBe(29.97)
    expect(round2(6.8931)).toBe(6.89)
  })

  it("supports custom decimals", () => {
    expect(round(1.23456, 4)).toBe(1.2346)
    expect(round(1.23456, 0)).toBe(1)
  })

  it("returns 0 for non-finite input", () => {
    expect(round2(NaN)).toBe(0)
    expect(round2(Infinity)).toBe(0)
  })
})

describe("formatMoney", () => {
  it("formats EUR in Slovak style", () => {
    // Non-breaking spaces; assert on the digits + symbol presence.
    const out = formatMoney(1234.5, "EUR", "sk-SK")
    expect(out).toContain("1")
    expect(out).toContain("234,50")
    expect(out).toContain("€")
  })
})
