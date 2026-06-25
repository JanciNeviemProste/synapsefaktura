import { describe, expect, it } from "vitest"

import {
  PLANS,
  PLAN_ORDER,
  planHasFeature,
  minTierFor,
  type Feature,
} from "./plans"

describe("plan feature matrix", () => {
  it("free grants no gated feature", () => {
    expect(PLANS.free.features.size).toBe(0)
    expect(planHasFeature("free", "aiCapture")).toBe(false)
    expect(planHasFeature("free", "peppolSend")).toBe(false)
  })

  it("free has the document limit; paid tiers are unlimited", () => {
    expect(PLANS.free.docsPerMonth).toBeGreaterThan(0)
    expect(PLANS.pro.docsPerMonth).toBeNull()
    expect(PLANS.business.docsPerMonth).toBeNull()
  })

  it("pro grants the AI features but not Business-only ones", () => {
    expect(planHasFeature("pro", "aiCapture")).toBe(true)
    expect(planHasFeature("pro", "nlInvoice")).toBe(true)
    expect(planHasFeature("pro", "assistant")).toBe(true)
    expect(planHasFeature("pro", "smartReminders")).toBe(true)
    // Business-only:
    expect(planHasFeature("pro", "forecast")).toBe(false)
    expect(planHasFeature("pro", "multiUser")).toBe(false)
    expect(planHasFeature("pro", "peppolSend")).toBe(false)
    expect(planHasFeature("pro", "api")).toBe(false)
  })

  it("business grants every feature", () => {
    const all: Feature[] = [
      "aiCapture",
      "nlInvoice",
      "assistant",
      "smartReminders",
      "forecast",
      "anomaly",
      "multiUser",
      "peppolSend",
      "advancedReports",
      "api",
    ]
    for (const f of all) expect(planHasFeature("business", f)).toBe(true)
  })

  it("features are monotonic up the plan order", () => {
    // anything a lower tier grants, every higher tier also grants
    for (let i = 0; i < PLAN_ORDER.length - 1; i++) {
      const lower = PLANS[PLAN_ORDER[i]].features
      const higher = PLANS[PLAN_ORDER[i + 1]].features
      for (const f of lower) expect(higher.has(f)).toBe(true)
    }
  })

  it("minTierFor returns the lowest granting tier", () => {
    expect(minTierFor("aiCapture")).toBe("pro")
    expect(minTierFor("peppolSend")).toBe("business")
    expect(minTierFor("multiUser")).toBe("business")
  })
})
