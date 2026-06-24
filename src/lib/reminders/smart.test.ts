import { describe, it, expect } from "vitest"

import { paymentBehaviourScore, predictLatenessDays } from "./smart"

describe("paymentBehaviourScore", () => {
  it("returns a neutral score for empty history", () => {
    expect(paymentBehaviourScore([])).toBe(50)
  })

  it("gives a perfect score to an always-on-time payer", () => {
    expect(paymentBehaviourScore([0, 0, 0, 0])).toBe(100)
  })

  it("treats early payments (negative days) as on time", () => {
    expect(paymentBehaviourScore([-3, -1, 0, -5])).toBe(100)
  })

  it("gives a low score to a chronically ~20-days-late payer", () => {
    const score = paymentBehaviourScore([20, 22, 18, 21, 19])
    expect(score).toBeLessThan(40)
    expect(score).toBeGreaterThan(0)
  })

  it("floors the score at 0 for very late payers (>= saturation)", () => {
    expect(paymentBehaviourScore([30, 45, 60])).toBe(0)
  })

  it("ranks an on-time payer above a late payer", () => {
    const onTime = paymentBehaviourScore([1, 0, 2, 1])
    const late = paymentBehaviourScore([15, 20, 18, 25])
    expect(onTime).toBeGreaterThan(late)
  })

  it("always returns a value within 0..100", () => {
    for (const h of [[0], [5, 5], [100, 100], [-10], [7, 3, 12]]) {
      const s = paymentBehaviourScore(h)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })
})

describe("predictLatenessDays", () => {
  it("predicts 0 for empty history", () => {
    expect(predictLatenessDays([])).toBe(0)
  })

  it("predicts 0 for an always-on-time payer", () => {
    expect(predictLatenessDays([0, 0, 0])).toBe(0)
  })

  it("uses the median (odd count)", () => {
    expect(predictLatenessDays([2, 20, 5])).toBe(5)
  })

  it("uses the median (even count)", () => {
    expect(predictLatenessDays([4, 6, 10, 20])).toBe(8)
  })

  it("is robust to a single huge outlier", () => {
    expect(predictLatenessDays([3, 4, 5, 4, 365])).toBe(4)
  })

  it("clamps early payments to 0 before taking the median", () => {
    expect(predictLatenessDays([-10, -5, 0])).toBe(0)
  })

  it("predicts ~20 for a chronically 20-days-late payer", () => {
    expect(predictLatenessDays([18, 20, 22, 19, 21])).toBe(20)
  })
})
