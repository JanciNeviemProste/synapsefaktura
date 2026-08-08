import { describe, it, expect } from "vitest"
import {
  resolveTravelRate,
  trailerEligible,
  type TravelRate,
} from "@/lib/logbook/rates"

function rate(p: Partial<TravelRate>): TravelRate {
  return {
    organization_id: null,
    vehicle_category: "passenger",
    valid_from: "2025-01-01",
    valid_to: null,
    rate_per_km: 0.264,
    fuel_rate_per_km: null,
    currency: "EUR",
    source_ref: null,
    source_url: null,
    confirmed_at: "2026-01-01T00:00:00Z",
    ...p,
  }
}

/** Zákonné sadzby tak, ako ich seeduje migrácia 20260805150000. */
const STATUTORY: TravelRate[] = [
  rate({
    valid_from: "2024-05-01",
    valid_to: "2025-02-28",
    rate_per_km: 0.265,
    vehicle_category: "passenger",
  }),
  rate({
    valid_from: "2024-05-01",
    valid_to: "2025-02-28",
    rate_per_km: 0.075,
    vehicle_category: "motorcycle",
  }),
  rate({
    valid_from: "2025-03-01",
    valid_to: "2025-05-31",
    rate_per_km: 0.281,
    vehicle_category: "passenger",
  }),
  rate({
    valid_from: "2025-03-01",
    valid_to: "2025-05-31",
    rate_per_km: 0.08,
    vehicle_category: "motorcycle",
  }),
  rate({
    valid_from: "2025-06-01",
    valid_to: "2025-12-31",
    rate_per_km: 0.296,
    vehicle_category: "passenger",
  }),
  rate({
    valid_from: "2025-06-01",
    valid_to: "2025-12-31",
    rate_per_km: 0.085,
    vehicle_category: "motorcycle",
  }),
  rate({
    valid_from: "2026-01-01",
    valid_to: null,
    rate_per_km: 0.313,
    vehicle_category: "passenger",
  }),
  rate({
    valid_from: "2026-01-01",
    valid_to: null,
    rate_per_km: 0.09,
    vehicle_category: "motorcycle",
  }),
]

describe("resolveTravelRate", () => {
  it("vrati null, ked ziadna sadzba nie je zadana", () => {
    expect(resolveTravelRate([], "2026-03-15")).toBeNull()
  })

  it("berie sadzbu platnu k DATUMU JAZDY, nie tu najnovsiu", () => {
    const stara = rate({
      valid_from: "2024-01-01",
      valid_to: "2024-12-31",
      rate_per_km: 0.25,
    })
    const nova = rate({ valid_from: "2025-01-01", rate_per_km: 0.28 })

    expect(resolveTravelRate([stara, nova], "2024-06-01")?.rate_per_km).toBe(
      0.25,
    )
    expect(resolveTravelRate([stara, nova], "2025-06-01")?.rate_per_km).toBe(
      0.28,
    )
  })

  it("hranice platnosti su vratane oboch dni", () => {
    const r = rate({ valid_from: "2025-01-01", valid_to: "2025-12-31" })
    expect(resolveTravelRate([r], "2025-01-01")).not.toBeNull()
    expect(resolveTravelRate([r], "2025-12-31")).not.toBeNull()
    expect(resolveTravelRate([r], "2024-12-31")).toBeNull()
    expect(resolveTravelRate([r], "2026-01-01")).toBeNull()
  })

  it("vlastna sadzba firmy ma prednost pred zakonnou", () => {
    const zakonna = rate({ organization_id: null, rate_per_km: 0.264 })
    const vlastna = rate({ organization_id: "org-1", rate_per_km: 0.35 })

    expect(
      resolveTravelRate([zakonna, vlastna], "2026-03-15")?.rate_per_km,
    ).toBe(0.35)
    expect(resolveTravelRate([zakonna], "2026-03-15")?.rate_per_km).toBe(0.264)
  })

  it("pri prekryve vyhrava neskorsi zaciatok platnosti", () => {
    const a = rate({ valid_from: "2025-01-01", rate_per_km: 0.26 })
    const b = rate({ valid_from: "2025-07-01", rate_per_km: 0.29 })
    expect(resolveTravelRate([a, b], "2025-09-01")?.rate_per_km).toBe(0.29)
  })

  it("vlastna sadzba vyhra aj ked je starsia nez zakonna", () => {
    const zakonna = rate({
      organization_id: null,
      valid_from: "2026-01-01",
      rate_per_km: 0.28,
    })
    const vlastna = rate({
      organization_id: "org-1",
      valid_from: "2025-01-01",
      rate_per_km: 0.35,
    })
    expect(
      resolveTravelRate([zakonna, vlastna], "2026-06-01")?.rate_per_km,
    ).toBe(0.35)
  })
})

describe("resolveTravelRate — kategoria vozidla", () => {
  it("da spravnu zakonnu sadzbu pre kazde obdobie a kategoriu", () => {
    // Presne to, co by pri danovej kontrole niekto prepocitaval.
    const cases: [string, "passenger" | "motorcycle", number][] = [
      ["2024-06-15", "passenger", 0.265],
      ["2024-06-15", "motorcycle", 0.075],
      ["2025-04-15", "passenger", 0.281],
      ["2025-04-15", "motorcycle", 0.08],
      ["2025-07-15", "passenger", 0.296],
      ["2025-07-15", "motorcycle", 0.085],
      ["2026-03-15", "passenger", 0.313],
      ["2026-03-15", "motorcycle", 0.09],
    ]
    for (const [date, category, expected] of cases) {
      expect(resolveTravelRate(STATUTORY, date, category)?.rate_per_km).toBe(
        expected,
      )
    }
  })

  it("bez uvedenia kategorie rata s osobnym autom", () => {
    expect(resolveTravelRate(STATUTORY, "2026-03-15")?.rate_per_km).toBe(0.313)
  })

  it("NEPOUZIJE sadzbu inej kategorie", () => {
    // Zamena by dala 3,5-nasobok zakonneho stropu, tak radsej nic.
    const lenAuto = [
      rate({ vehicle_category: "passenger", rate_per_km: 0.313 }),
    ]
    expect(resolveTravelRate(lenAuto, "2026-03-15", "motorcycle")).toBeNull()
  })

  it("sadzba bez kategorie plati pre akekolvek vozidlo", () => {
    // Tak sa zadava vlastna sadzba firmy.
    const vlastna = [
      rate({
        organization_id: "org-1",
        vehicle_category: null,
        rate_per_km: 0.4,
      }),
    ]
    expect(
      resolveTravelRate(vlastna, "2026-03-15", "passenger")?.rate_per_km,
    ).toBe(0.4)
    expect(
      resolveTravelRate(vlastna, "2026-03-15", "motorcycle")?.rate_per_km,
    ).toBe(0.4)
  })

  it("stvorkolka pouzije sadzbu motocykla", () => {
    // Oznamenia ich zoskupuju ("dvojkolesove, trojkolesove vozidla
    // a stvorkolky: 0,090 eura"), takze vlastny riadok nema.
    expect(
      resolveTravelRate(STATUTORY, "2026-03-15", "quad")?.rate_per_km,
    ).toBe(0.09)
    expect(
      resolveTravelRate(STATUTORY, "2025-04-15", "quad")?.rate_per_km,
    ).toBe(0.08)
  })

  it("presna kategoria vyhrava nad sadzbou bez kategorie", () => {
    const bezKategorie = rate({
      organization_id: "org-1",
      vehicle_category: null,
      rate_per_km: 0.4,
    })
    const preMotorku = rate({
      organization_id: "org-1",
      vehicle_category: "motorcycle",
      rate_per_km: 0.12,
    })
    expect(
      resolveTravelRate([bezKategorie, preMotorku], "2026-03-15", "motorcycle")
        ?.rate_per_km,
    ).toBe(0.12)
  })
})

describe("resolveTravelRate — nepotvrdena sadzba", () => {
  it("navrhnuta sadzba sa NEPOUZIJE, kym ju niekto nepotvrdi", () => {
    const stara = rate({ valid_from: "2026-01-01", rate_per_km: 0.313 })
    const navrhnuta = rate({
      valid_from: "2026-07-01",
      rate_per_km: 0.33,
      confirmed_at: null,
    })
    // Do potvrdenia sa pocita starou.
    expect(
      resolveTravelRate([stara, navrhnuta], "2026-08-15")?.rate_per_km,
    ).toBe(0.313)
  })

  it("po potvrdeni sa zacne pouzivat", () => {
    const stara = rate({
      valid_from: "2026-01-01",
      valid_to: "2026-06-30",
      rate_per_km: 0.313,
    })
    const potvrdena = rate({ valid_from: "2026-07-01", rate_per_km: 0.33 })
    expect(
      resolveTravelRate([stara, potvrdena], "2026-08-15")?.rate_per_km,
    ).toBe(0.33)
  })

  it("samotna nepotvrdena sadzba znamena ziadnu sadzbu", () => {
    const navrhnuta = [rate({ confirmed_at: null })]
    expect(resolveTravelRate(navrhnuta, "2026-03-15")).toBeNull()
  })
})

describe("trailerEligible", () => {
  it("osobne auto a stvorkolka maju na priplatok narok", () => {
    // Zakon c. 283/2002 Z. z.: prives k STVORKOLKE alebo k OSOBNEMU vozidlu.
    expect(trailerEligible("passenger")).toBe(true)
    expect(trailerEligible("quad")).toBe(true)
  })

  it("motocykel a trojkolka nie", () => {
    expect(trailerEligible("motorcycle")).toBe(false)
  })

  it("stvorkolka ma sadzbu motocykla, ale narok na prives ako auto", () => {
    // Presne preto nemoze byt `quad` zluceny s `motorcycle`.
    expect(
      resolveTravelRate(STATUTORY, "2026-03-15", "quad")?.rate_per_km,
    ).toBe(
      resolveTravelRate(STATUTORY, "2026-03-15", "motorcycle")?.rate_per_km,
    )
    expect(trailerEligible("quad")).not.toBe(trailerEligible("motorcycle"))
  })
})
