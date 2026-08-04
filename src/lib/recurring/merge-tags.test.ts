import { describe, it, expect } from "vitest"
import {
  applyMergeTags,
  fromIsoDate,
  nextRunDate,
  planRecurringRuns,
  toIsoDate,
  MAX_CATCH_UP_RUNS,
} from "./merge-tags"

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

describe("toIsoDate / fromIsoDate", () => {
  it("round-trips a local calendar day", () => {
    expect(toIsoDate(new Date(2026, 0, 1))).toBe("2026-01-01")
    expect(toIsoDate(fromIsoDate("2026-01-01")!)).toBe("2026-01-01")
    // Poludnie chrani pred posunom o den v zapadnych zonach.
    expect(fromIsoDate("2026-03-31")!.getDate()).toBe(31)
  })

  it("accepts a timestamp prefix and rejects junk", () => {
    expect(toIsoDate(fromIsoDate("2026-05-08T00:00:00Z")!)).toBe("2026-05-08")
    expect(fromIsoDate("8.5.2026")).toBeNull()
    expect(fromIsoDate(null)).toBeNull()
  })
})

describe("planRecurringRuns", () => {
  it("generates nothing when the next run is still in the future", () => {
    const plan = planRecurringRuns("2026-09-01", "2026-08-04", "monthly")
    expect(plan.runDates).toEqual([])
    expect(plan.nextRunAt).toBe("2026-09-01")
    expect(plan.capped).toBe(false)
  })

  it("generates one run when due today", () => {
    const plan = planRecurringRuns("2026-08-04", "2026-08-04", "monthly")
    expect(plan.runDates).toEqual(["2026-08-04"])
    expect(plan.nextRunAt).toBe("2026-09-04")
    expect(plan.capped).toBe(false)
  })

  it("keeps the schedule anchored — no drift towards the run day", () => {
    // Cron bezal az 7. augusta, ale faktura patri na 1. dna v mesiaci.
    const plan = planRecurringRuns("2026-08-01", "2026-08-07", "monthly")
    expect(plan.runDates).toEqual(["2026-08-01"])
    expect(plan.nextRunAt).toBe("2026-09-01")
  })

  it("catches up every missed period instead of skipping to today", () => {
    const plan = planRecurringRuns("2026-05-01", "2026-08-04", "monthly")
    expect(plan.runDates).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ])
    expect(plan.nextRunAt).toBe("2026-09-01")
    expect(plan.capped).toBe(false)
  })

  it("advances weekly from next_run_at, not from today", () => {
    const plan = planRecurringRuns("2026-07-06", "2026-07-27", "weekly")
    expect(plan.runDates).toEqual([
      "2026-07-06",
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
    ])
    expect(plan.nextRunAt).toBe("2026-08-03")
  })

  it("honours a custom interval (and falls back to 30 days)", () => {
    expect(
      planRecurringRuns("2026-01-01", "2026-01-25", "custom", 10).runDates,
    ).toEqual(["2026-01-01", "2026-01-11", "2026-01-21"])
    expect(
      planRecurringRuns("2026-01-01", "2026-02-05", "custom", 0).runDates,
    ).toEqual(["2026-01-01", "2026-01-31"])
  })

  it("caps the catch-up and leaves the rest for the next run", () => {
    const plan = planRecurringRuns("2024-08-01", "2026-08-04", "monthly")
    expect(plan.runDates).toHaveLength(MAX_CATCH_UP_RUNS)
    expect(plan.runDates[0]).toBe("2024-08-01")
    expect(plan.capped).toBe(true)
    // Kurzor ostava v minulosti — zvysne obdobia sa dobehnu, nezahodia sa.
    expect(plan.nextRunAt).toBe("2025-08-01")
  })

  it("returns the schedule untouched for an unparsable date", () => {
    const plan = planRecurringRuns("nikdy", "2026-08-04", "monthly")
    expect(plan.runDates).toEqual([])
    expect(plan.nextRunAt).toBe("nikdy")
    expect(plan.capped).toBe(false)
  })
})
