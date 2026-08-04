import { describe, it, expect } from "vitest"
import {
  normalizeIban,
  formatIban,
  isValidIban,
  normalizeSwift,
  isValidSwift,
  bankAccountSchema,
} from "./bank-account"

describe("normalizeIban", () => {
  it("strips spaces and dashes, uppercases", () => {
    expect(normalizeIban("sk31 1200 0000 1987 4263 7541")).toBe(
      "SK3112000000198742637541",
    )
    expect(normalizeIban("SK31-1200-0000-1987-4263-7541")).toBe(
      "SK3112000000198742637541",
    )
    expect(normalizeIban(null)).toBe("")
  })
})

describe("formatIban", () => {
  it("groups by four", () => {
    expect(formatIban("SK3112000000198742637541")).toBe(
      "SK31 1200 0000 1987 4263 7541",
    )
    expect(formatIban("")).toBe("")
  })
})

describe("isValidIban", () => {
  it("accepts valid IBANs regardless of spacing/case", () => {
    expect(isValidIban("SK3112000000198742637541")).toBe(true)
    expect(isValidIban("sk31 1200 0000 1987 4263 7541")).toBe(true)
    expect(isValidIban("SK8975000000000012345671")).toBe(true)
    expect(isValidIban("CZ6508000000192000145399")).toBe(true)
    expect(isValidIban("DE89370400440532013000")).toBe(true)
  })

  it("rejects a wrong check digit (typo)", () => {
    expect(isValidIban("SK1109000000000123456789")).toBe(false)
    // Prehodene dve cislice v platnom IBAN.
    expect(isValidIban("SK3112000000198742635741")).toBe(false)
  })

  it("rejects wrong length for a known country", () => {
    expect(isValidIban("SK311200000019874263754")).toBe(false)
    expect(isValidIban("SK31120000001987426375411")).toBe(false)
  })

  it("rejects malformed input", () => {
    expect(isValidIban("")).toBe(false)
    expect(isValidIban(null)).toBe(false)
    expect(isValidIban("1231 1200 0000 1987 4263 7541")).toBe(false)
    expect(isValidIban("SKAB12000000198742637541")).toBe(false)
    expect(isValidIban("SK31_1200/0000*1987")).toBe(false)
  })
})

describe("swift", () => {
  it("normalizes and validates 8 or 11 chars", () => {
    expect(normalizeSwift(" tatr skbx ")).toBe("TATRSKBX")
    expect(isValidSwift("TATRSKBX")).toBe(true)
    expect(isValidSwift("tatrskbxxxx")).toBe(true)
    expect(isValidSwift("TATRSK")).toBe(false)
    expect(isValidSwift("TATRSKBXX")).toBe(false)
    expect(isValidSwift("")).toBe(false)
  })
})

describe("bankAccountSchema", () => {
  it("normalizes the stored values", () => {
    const parsed = bankAccountSchema.parse({
      iban: "sk31 1200 0000 1987 4263 7541",
      swift: " tatrskbx ",
      bankName: "  Tatra banka  ",
      currency: "eur",
      isDefault: true,
    })
    expect(parsed).toEqual({
      iban: "SK3112000000198742637541",
      swift: "TATRSKBX",
      bankName: "Tatra banka",
      currency: "EUR",
      isDefault: true,
    })
  })

  it("applies defaults and drops empty optionals", () => {
    const parsed = bankAccountSchema.parse({
      iban: "SK3112000000198742637541",
      swift: "",
      bankName: "",
    })
    expect(parsed.currency).toBe("EUR")
    expect(parsed.isDefault).toBe(false)
    expect(parsed.swift).toBeUndefined()
    expect(parsed.bankName).toBeUndefined()
  })

  it("rejects an invalid IBAN, SWIFT and currency", () => {
    expect(
      bankAccountSchema.safeParse({ iban: "SK1109000000000123456789" }).success,
    ).toBe(false)
    expect(bankAccountSchema.safeParse({ iban: "" }).success).toBe(false)
    expect(
      bankAccountSchema.safeParse({
        iban: "SK3112000000198742637541",
        swift: "NOPE",
      }).success,
    ).toBe(false)
    expect(
      bankAccountSchema.safeParse({
        iban: "SK3112000000198742637541",
        currency: "EURO",
      }).success,
    ).toBe(false)
  })
})
