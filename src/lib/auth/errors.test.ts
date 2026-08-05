import { describe, it, expect } from "vitest"
import { isUnconfirmedEmail, isEmailRateLimited } from "@/lib/auth/errors"

describe("isUnconfirmedEmail", () => {
  it("rozpozná kód aj text", () => {
    expect(isUnconfirmedEmail({ code: "email_not_confirmed" })).toBe(true)
    expect(isUnconfirmedEmail({ message: "Email not confirmed" })).toBe(true)
    expect(isUnconfirmedEmail({ message: "email not confirmed" })).toBe(true)
  })

  it("zlé heslo za nepotvrdený účet nevydáva", () => {
    // Táto zámena by bola horšia než pôvodný stav: poslala by človeka
    // čakať na e-mail, ktorý nepotrebuje.
    expect(isUnconfirmedEmail({ message: "Invalid login credentials" })).toBe(
      false,
    )
    expect(isUnconfirmedEmail({ code: "invalid_credentials" })).toBe(false)
  })

  it("nespadne na prázdnej chybe", () => {
    expect(isUnconfirmedEmail({})).toBe(false)
  })
})

describe("isEmailRateLimited", () => {
  it("rozpozná strop odosielania", () => {
    expect(isEmailRateLimited({ code: "over_email_send_rate_limit" })).toBe(true)
    expect(
      isEmailRateLimited({ message: "For security purposes, you can only request this after 51 seconds." }),
    ).toBe(true)
    expect(isEmailRateLimited({ message: "Email rate limit exceeded" })).toBe(true)
  })

  it("bežnú chybu za limit nevydáva", () => {
    expect(isEmailRateLimited({ message: "User already registered" })).toBe(false)
    expect(isEmailRateLimited({})).toBe(false)
  })
})
