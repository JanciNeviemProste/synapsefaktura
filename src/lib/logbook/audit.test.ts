import { describe, expect, it } from "vitest"

import { auditLogbook, type AuditInput, type AuditTrip } from "./audit"

/** Intl pouziva pevnu medzeru; testy porovnavaju citatelny text. */
function plain(message: string): string {
  return message.replace(/[\u00a0\u202f]/g, " ")
}

function codes(findings: { code: string }[]): string[] {
  return findings.map((f) => f.code)
}

function trip(
  date: string,
  km: number,
  extra: Partial<AuditTrip> = {},
): AuditTrip {
  return {
    date,
    km,
    purpose: "business",
    odometerStart: null,
    odometerEnd: null,
    ...extra,
  }
}

/** Zdravy zaklad: 500 km pri 6 l/100 km = 30 l, natankovanych presne 30 l. */
function baseInput(over: Partial<AuditInput> = {}): AuditInput {
  return {
    vehicle: { consumptionPer100Km: 6, odometerKm: 50_000 },
    trips: [trip("2026-03-10", 500)],
    refuelings: [{ date: "2026-03-10", litres: 30 }],
    periodFrom: "2026-03-01",
    periodTo: "2026-03-31",
    ...over,
  }
}

describe("auditLogbook — cista kniha jazd", () => {
  it("bez nezrovnalosti nevrati nic", () => {
    expect(auditLogbook(baseInput())).toEqual([])
  })

  it("prazdne obdobie nehlasi nic", () => {
    expect(auditLogbook(baseInput({ trips: [], refuelings: [] }))).toEqual([])
  })
})

describe("auditLogbook — nedostatok paliva", () => {
  it("vykazane km nad ramec natankovaneho paliva su chyba", () => {
    const findings = auditLogbook(
      baseInput({
        vehicle: { consumptionPer100Km: 5.8, odometerKm: 50_000 },
        trips: [trip("2026-03-10", 2400)],
        refuelings: [{ date: "2026-03-10", litres: 90 }],
      }),
    )
    const shortage = findings.find((f) => f.code === "fuel_shortage")
    expect(shortage?.severity).toBe("error")
    // Presne dvojica cisel, ktoru pri kontrole pocita kontrolor.
    expect(plain(shortage!.message)).toContain(
      "vykázaných 2 400 km zodpovedá 139,2 l, natankovaných bolo len 90,0 l",
    )
    // A uznat sa da len to nizsie z dvojice.
    expect(plain(shortage!.message)).toContain("teda 90,0 l")
    expect(plain(shortage!.message)).toContain("chýba doklad na 49,2 l")
  })

  it("rozdiel do 5 % je v tolerancii nadrze", () => {
    const findings = auditLogbook(
      baseInput({
        vehicle: { consumptionPer100Km: 8, odometerKm: 50_000 },
        trips: [trip("2026-03-10", 100)],
        refuelings: [{ date: "2026-03-10", litres: 7.7 }],
      }),
    )
    expect(codes(findings)).not.toContain("fuel_shortage")
  })
})

describe("auditLogbook — prebytok paliva", () => {
  it("vyrazne viac paliva nez jazd je varovanie, nie chyba", () => {
    const findings = auditLogbook(
      baseInput({ refuelings: [{ date: "2026-03-10", litres: 60 }] }),
    )
    const surplus = findings.find((f) => f.code === "fuel_surplus")
    expect(surplus?.severity).toBe("warning")
    expect(plain(surplus!.message)).toContain("natankovaných 60,0 l")
    expect(plain(surplus!.message)).toContain("zodpovedá len 30,0 l")
    expect(codes(findings)).not.toContain("fuel_shortage")
  })

  it("prebytok pod 5 l sa nehlasi ani pri velkom pomere", () => {
    const findings = auditLogbook(
      baseInput({
        trips: [trip("2026-03-10", 10)],
        refuelings: [{ date: "2026-03-10", litres: 3 }],
      }),
    )
    expect(codes(findings)).not.toContain("fuel_surplus")
  })
})

describe("auditLogbook — sukromne jazdy", () => {
  const withPrivate = baseInput({
    vehicle: { consumptionPer100Km: 5.8, odometerKm: 50_000 },
    trips: [
      trip("2026-03-10", 2000),
      trip("2026-03-11", 400, { purpose: "private" }),
    ],
    refuelings: [{ date: "2026-03-10", litres: 139.2 }],
  })

  it("sukromne km sa zapocitavaju do spotreby", () => {
    // 2 400 km x 5,8 = 139,2 l — presne natankovane, teda ziadny nedostatok.
    expect(codes(auditLogbook(withPrivate))).not.toContain("fuel_shortage")
  })

  it("palivo len na sluzobne km je uz nedostatok", () => {
    // 116 l pokryva 2 000 sluzobnych km, ale auto najazdilo 2 400.
    const findings = auditLogbook({
      ...withPrivate,
      refuelings: [{ date: "2026-03-10", litres: 116 }],
    })
    expect(codes(findings)).toContain("fuel_shortage")
  })

  it("sukromnu cast oddeli od danovo uznatelnej", () => {
    const share = auditLogbook(withPrivate).find(
      (f) => f.code === "private_share",
    )
    expect(share?.severity).toBe("info")
    expect(plain(share!.message)).toContain(
      "Z 2 400 km je 400 km súkromných (23,2 l); služobných je 2 000 km (116,0 l)",
    )
  })

  it("bez sukromnych jazd sa nalez nehlasi", () => {
    expect(codes(auditLogbook(baseInput()))).not.toContain("private_share")
  })
})

describe("auditLogbook — chybajuca spotreba", () => {
  it("bez normovanej spotreby je to chyba a palivo sa neporovnava", () => {
    const findings = auditLogbook(
      baseInput({
        vehicle: { consumptionPer100Km: null, odometerKm: 50_000 },
        refuelings: [{ date: "2026-03-10", litres: 90 }],
      }),
    )
    const missing = findings.find((f) => f.code === "missing_consumption")
    expect(missing?.severity).toBe("error")
    expect(missing!.message).toContain("normovanú spotrebu")
    expect(codes(findings)).not.toContain("fuel_shortage")
    expect(codes(findings)).not.toContain("fuel_surplus")
  })

  it("nulova spotreba sa berie ako nevyplnena", () => {
    const findings = auditLogbook(
      baseInput({ vehicle: { consumptionPer100Km: 0, odometerKm: 50_000 } }),
    )
    expect(codes(findings)).toContain("missing_consumption")
  })

  it("ostatne kontroly bezia aj bez spotreby", () => {
    const findings = auditLogbook(
      baseInput({
        vehicle: { consumptionPer100Km: null, odometerKm: 50_000 },
        refuelings: [{ date: "2026-03-15", litres: 30 }],
      }),
    )
    expect(codes(findings)).toContain("refueling_without_trip")
  })
})

describe("auditLogbook — tachometer", () => {
  it("diera medzi koncom a zaciatkom nasledujucej jazdy", () => {
    const findings = auditLogbook(
      baseInput({
        trips: [
          trip("2026-03-10", 100, {
            odometerStart: 45_000,
            odometerEnd: 45_100,
          }),
          trip("2026-03-11", 200, {
            odometerStart: 45_300,
            odometerEnd: 45_500,
          }),
        ],
        refuelings: [{ date: "2026-03-10", litres: 18 }],
      }),
    )
    const gap = findings.find((f) => f.code === "odometer_gap")
    expect(gap?.severity).toBe("warning")
    expect(plain(gap!.message)).toContain("jazda 11.3.2026 začína na 45 300 km")
    expect(plain(gap!.message)).toContain("skončila na 45 100 km")
    expect(plain(gap!.message)).toContain("chýba 200 km")
  })

  it("nadvazujuce stavy nehlasia nic", () => {
    const findings = auditLogbook(
      baseInput({
        trips: [
          trip("2026-03-10", 100, {
            odometerStart: 45_000,
            odometerEnd: 45_100,
          }),
          trip("2026-03-11", 200, {
            odometerStart: 45_100,
            odometerEnd: 45_300,
          }),
        ],
        refuelings: [{ date: "2026-03-10", litres: 18 }],
      }),
    )
    expect(codes(findings)).not.toContain("odometer_gap")
    expect(codes(findings)).not.toContain("odometer_backwards")
  })

  it("klesnuty stav tachometra je chyba", () => {
    const findings = auditLogbook(
      baseInput({
        trips: [
          trip("2026-03-10", 100, {
            odometerStart: 45_000,
            odometerEnd: 45_100,
          }),
          trip("2026-03-11", 200, {
            odometerStart: 44_900,
            odometerEnd: 45_100,
          }),
        ],
        refuelings: [{ date: "2026-03-10", litres: 18 }],
      }),
    )
    const back = findings.find((f) => f.code === "odometer_backwards")
    expect(back?.severity).toBe("error")
    expect(plain(back!.message)).toContain("Stav tachometra klesol")
  })

  it("jazdy bez stavu tachometra sa do retazca neberu", () => {
    const findings = auditLogbook(
      baseInput({
        trips: [
          trip("2026-03-10", 100, {
            odometerStart: 45_000,
            odometerEnd: 45_100,
          }),
          trip("2026-03-11", 200),
          trip("2026-03-12", 100, {
            odometerStart: 45_100,
            odometerEnd: 45_200,
          }),
        ],
        refuelings: [{ date: "2026-03-10", litres: 24 }],
      }),
    )
    expect(codes(findings)).not.toContain("odometer_gap")
  })
})

describe("auditLogbook — tankovanie bez jazdy", () => {
  it("tankovanie v den bez jazdy je info", () => {
    const findings = auditLogbook(
      baseInput({ refuelings: [{ date: "2026-03-15", litres: 30 }] }),
    )
    const orphan = findings.find((f) => f.code === "refueling_without_trip")
    expect(orphan?.severity).toBe("info")
    expect(plain(orphan!.message)).toContain("Tankovanie 15.3.2026 (30,0 l)")
  })

  it("tankovanie v den jazdy je v poriadku", () => {
    expect(codes(auditLogbook(baseInput()))).not.toContain(
      "refueling_without_trip",
    )
  })
})

describe("auditLogbook — obdobie a poradie", () => {
  it("jazdy a tankovania mimo obdobia sa ignoruju", () => {
    const findings = auditLogbook(
      baseInput({
        trips: [trip("2026-02-28", 2000), trip("2026-03-10", 500)],
        refuelings: [
          { date: "2026-02-28", litres: 120 },
          { date: "2026-03-10", litres: 30 },
        ],
      }),
    )
    expect(findings).toEqual([])
  })

  it("hranicne dni obdobia patria dovnutra", () => {
    const findings = auditLogbook(
      baseInput({
        trips: [trip("2026-03-01", 250), trip("2026-03-31", 250)],
        refuelings: [
          { date: "2026-03-01", litres: 15 },
          { date: "2026-03-31", litres: 15 },
        ],
      }),
    )
    expect(findings).toEqual([])
  })

  it("nalezy su zoradene od najzavaznejsieho", () => {
    const findings = auditLogbook(
      baseInput({
        vehicle: { consumptionPer100Km: 5.8, odometerKm: 50_000 },
        trips: [
          trip("2026-03-10", 2000, {
            odometerStart: 45_000,
            odometerEnd: 47_000,
          }),
          trip("2026-03-11", 400, {
            purpose: "private",
            odometerStart: 47_500,
            odometerEnd: 47_900,
          }),
        ],
        refuelings: [{ date: "2026-03-20", litres: 20 }],
      }),
    )
    expect(findings.map((f) => f.severity)).toEqual([
      "error",
      "warning",
      "info",
      "info",
    ])
    expect(codes(findings)).toEqual([
      "fuel_shortage",
      "odometer_gap",
      "refueling_without_trip",
      "private_share",
    ])
  })
})
