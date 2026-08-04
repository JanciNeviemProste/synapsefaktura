import { describe, it, expect } from "vitest"
import {
  VARIABLE_SYMBOL_MAX_LENGTH,
  variableSymbolFromNumber,
} from "./variable-symbol"

describe("variableSymbolFromNumber", () => {
  it("strips a letter prefix", () => {
    expect(variableSymbolFromNumber("FA20260001")).toBe("20260001")
  })

  it("strips dashes and other separators", () => {
    expect(variableSymbolFromNumber("FA-2026-0001")).toBe("20260001")
    expect(variableSymbolFromNumber("2026/0042")).toBe("20260042")
  })

  it("keeps a plain numeric document number", () => {
    expect(variableSymbolFromNumber("20260001")).toBe("20260001")
  })

  it("returns null when the number has no digits", () => {
    expect(variableSymbolFromNumber("KONCEPT")).toBeNull()
    expect(variableSymbolFromNumber("---")).toBeNull()
    expect(variableSymbolFromNumber("")).toBeNull()
    expect(variableSymbolFromNumber(null)).toBeNull()
    expect(variableSymbolFromNumber(undefined)).toBeNull()
  })

  it("cuts an over-long number, keeping the last 10 digits", () => {
    // 14 cislic — zostava chvost (rok + poradie), nie zaciatok prefixu.
    const vs = variableSymbolFromNumber("FA-2026-000000123456")
    expect(vs).toBe("0000123456")
    expect(vs).toHaveLength(VARIABLE_SYMBOL_MAX_LENGTH)
  })

  it("leaves a number of exactly the maximum length untouched", () => {
    expect(variableSymbolFromNumber("1234567890")).toBe("1234567890")
  })
})
