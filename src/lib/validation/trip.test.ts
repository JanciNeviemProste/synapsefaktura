import { describe, it, expect } from "vitest"
import { tripSchema, ODOMETER_ORDER_MESSAGE } from "./trip"

const VEHICLE = "11111111-1111-4111-8111-111111111111"

function trip(extra: Record<string, unknown> = {}) {
  return { vehicleId: VEHICLE, tripDate: "2026-08-04", ...extra }
}

describe("tripSchema", () => {
  it("dopĺňa predvolené hodnoty pre jazdu bez tachometra", () => {
    const parsed = tripSchema.parse(trip())
    expect(parsed.purpose).toBe("business")
    expect(parsed.roundTrip).toBe(true)
    expect(parsed.distanceKm).toBe(0)
    expect(parsed.odometerStartKm).toBeUndefined()
    expect(parsed.odometerEndKm).toBeUndefined()
  })

  it("prázdny stav tachometra necháva nevyplnený, nie nulový", () => {
    const parsed = tripSchema.parse(
      trip({ odometerStartKm: "", odometerEndKm: "" }),
    )
    expect(parsed.odometerStartKm).toBeUndefined()
    expect(parsed.odometerEndKm).toBeUndefined()
  })

  it("odmietne nižší konečný stav tachometra než začiatočný", () => {
    const parsed = tripSchema.safeParse(
      trip({ odometerStartKm: 120_500, odometerEndKm: 120_400 }),
    )
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(ODOMETER_ORDER_MESSAGE)
    }
  })

  it("rovnaký začiatočný a konečný stav je v poriadku", () => {
    expect(
      tripSchema.safeParse(
        trip({ odometerStartKm: 120_500, odometerEndKm: 120_500 }),
      ).success,
    ).toBe(true)
  })

  it("pri chýbajúcom jednom stave poradie nekontroluje", () => {
    expect(tripSchema.safeParse(trip({ odometerEndKm: 120_400 })).success).toBe(
      true,
    )
  })

  it("odmietne zápornú dĺžku jazdy a neznámy typ", () => {
    expect(tripSchema.safeParse(trip({ distanceKm: -1 })).success).toBe(false)
    expect(tripSchema.safeParse(trip({ purpose: "vikendova" })).success).toBe(
      false,
    )
  })

  it("prijme obidva typy jázd", () => {
    for (const purpose of ["business", "private"] as const) {
      expect(tripSchema.parse(trip({ purpose })).purpose).toBe(purpose)
    }
  })
})
