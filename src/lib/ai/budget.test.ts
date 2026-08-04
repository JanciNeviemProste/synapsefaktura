import { describe, expect, it } from "vitest"

import {
  aiCostLimit,
  checkAiBudget,
  isOverBudget,
  monthStartIso,
  nextTierAfter,
  sumUsageCost,
} from "./budget"
import { PLANS } from "@/lib/billing/plans"

describe("monthStartIso", () => {
  it("vracia prvy den mesiaca o polnoci UTC", () => {
    expect(monthStartIso(new Date("2026-08-04T13:45:12.000Z"))).toBe(
      "2026-08-01T00:00:00.000Z",
    )
  })

  it("nepreklopi sa cez hranicu mesiaca (posledny den, neskoro vecer)", () => {
    expect(monthStartIso(new Date("2026-01-31T23:59:59.000Z"))).toBe(
      "2026-01-01T00:00:00.000Z",
    )
  })

  it("prvy okamih mesiaca je sam sebe hranicou", () => {
    expect(monthStartIso(new Date("2026-12-01T00:00:00.000Z"))).toBe(
      "2026-12-01T00:00:00.000Z",
    )
  })
})

describe("sumUsageCost", () => {
  it("prazdny zoznam je 0", () => {
    expect(sumUsageCost([])).toBe(0)
  })

  it("scita cisla aj numeric hodnoty poslane ako retazec", () => {
    expect(sumUsageCost([{ cost: 0.5 }, { cost: "0.25" }, { cost: 1 }])).toBe(
      1.75,
    )
  })

  it("ignoruje null a nepouzitelne hodnoty", () => {
    expect(sumUsageCost([{ cost: null }, { cost: "x" }, { cost: 0.1 }])).toBe(
      0.1,
    )
  })

  it("zaokruhli na 6 desatinnych miest (mena ai_usage.cost)", () => {
    expect(sumUsageCost([{ cost: 0.0000001 }, { cost: 0.0000002 }])).toBe(0)
    expect(sumUsageCost([{ cost: 0.1 }, { cost: 0.2 }])).toBe(0.3)
  })
})

describe("aiCostLimit", () => {
  const free = aiCostLimit("free") ?? 0
  const pro = aiCostLimit("pro") ?? 0
  const business = aiCostLimit("business") ?? 0

  it("kazdy plan ma ciselny strop", () => {
    expect(free).toBeGreaterThan(0)
    expect(pro).toBeGreaterThan(0)
    expect(business).toBeGreaterThan(0)
  })

  it("strop rastie s planom", () => {
    expect(free).toBeLessThan(pro)
    expect(pro).toBeLessThan(business)
  })
})

describe("nextTierAfter", () => {
  it("vracia najblizsi vyssi plan", () => {
    expect(nextTierAfter("free")).toBe("pro")
    expect(nextTierAfter("pro")).toBe("business")
  })

  it("najvyssi plan uz nema kam upgradovat", () => {
    expect(nextTierAfter("business")).toBeNull()
  })
})

describe("isOverBudget", () => {
  it("bez stropu (null) nikdy neprekroci", () => {
    expect(isOverBudget(null, 1_000_000)).toBe(false)
  })

  it("pod stropom prejde, na strope a nad nim uz nie", () => {
    expect(isOverBudget(3, 2.999999)).toBe(false)
    expect(isOverBudget(3, 3)).toBe(true)
    expect(isOverBudget(3, 3.5)).toBe(true)
  })

  it("fail-closed pri nezmyselnom sucte", () => {
    expect(isOverBudget(3, Number.NaN)).toBe(true)
    expect(isOverBudget(3, Number.POSITIVE_INFINITY)).toBe(true)
  })
})

describe("checkAiBudget", () => {
  it("nevycerpany strop pusti volanie dalej", () => {
    const verdict = checkAiBudget("pro", 0.5)
    expect(verdict.withinBudget).toBe(true)
    expect(verdict.used).toBe(0.5)
    expect(verdict.limit).toBe(PLANS.pro.aiMonthlyCostLimit)
  })

  it("vycerpany strop zamietne a vysvetli preco", () => {
    const limit = PLANS.free.aiMonthlyCostLimit ?? 0
    const verdict = checkAiBudget("free", limit)
    expect(verdict.withinBudget).toBe(false)
    if (verdict.withinBudget) throw new Error("ocakavane zamietnutie")
    expect(verdict.limit).toBe(limit)
    expect(verdict.reason).toContain(PLANS.free.label)
  })

  it("zaporny sucet sa neberie ako kredit", () => {
    const verdict = checkAiBudget("pro", -5)
    expect(verdict.withinBudget).toBe(true)
    expect(verdict.used).toBe(0)
  })

  it("nezmyselny sucet zamietne (fail-closed)", () => {
    const verdict = checkAiBudget("business", Number.NaN)
    expect(verdict.withinBudget).toBe(false)
  })
})
