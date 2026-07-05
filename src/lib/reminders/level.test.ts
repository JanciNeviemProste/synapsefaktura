import { describe, it, expect } from "vitest"
import { nextReminderLevel, MAX_REMINDER_LEVEL } from "./level"

describe("nextReminderLevel", () => {
  it("escalates from the existing reminder count", () => {
    expect(nextReminderLevel(0)).toBe(1)
    expect(nextReminderLevel(1)).toBe(2)
    expect(nextReminderLevel(2)).toBe(3)
  })

  it("stops (null) once the maximum is reached", () => {
    expect(nextReminderLevel(3)).toBeNull()
    expect(nextReminderLevel(10)).toBeNull()
  })

  it("honours an explicit level within range", () => {
    expect(nextReminderLevel(0, 2)).toBe(2)
    expect(nextReminderLevel(5, 1)).toBe(1)
  })

  it("rejects an out-of-range explicit level", () => {
    expect(nextReminderLevel(0, MAX_REMINDER_LEVEL + 1)).toBeNull()
    expect(nextReminderLevel(0, 0)).toBeNull()
  })
})
