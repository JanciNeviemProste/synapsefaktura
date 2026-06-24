import { describe, it, expect } from "vitest"
import { applyMergeTags, nextRunDate } from "./merge-tags"

describe("applyMergeTags", () => {
  const date = new Date(2026, 4, 8) // 8 May 2026 (month index 4)

  it("replaces month/year/date tags", () => {
    expect(applyMergeTags("Správa za #MESIAC_SLOVOM# #ROK#", date)).toBe(
      "Správa za máj 2026",
    )
    expect(applyMergeTags("#MESIAC#/#ROK#", date)).toBe("5/2026")
    expect(applyMergeTags("Vystavené #DATUM#", date)).toBe(
      "Vystavené 08.05.2026",
    )
  })

  it("leaves text without tags untouched", () => {
    expect(applyMergeTags("Bez tagov", date)).toBe("Bez tagov")
  })
})

describe("nextRunDate", () => {
  it("advances weekly / monthly / custom", () => {
    const base = new Date(2026, 0, 15) // 15 Jan 2026
    expect(nextRunDate(base, "weekly").getDate()).toBe(22)
    expect(nextRunDate(base, "monthly").getMonth()).toBe(1) // Feb
    expect(nextRunDate(base, "custom", 10).getDate()).toBe(25)
  })
})
