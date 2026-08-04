import { describe, it, expect } from "vitest"
import { resolveTravelRate, type TravelRate } from "@/lib/logbook/rates"

function rate(p: Partial<TravelRate>): TravelRate {
  return {
    organization_id: null,
    valid_from: "2025-01-01",
    valid_to: null,
    rate_per_km: 0.264,
    fuel_rate_per_km: null,
    currency: "EUR",
    ...p,
  }
}

describe("resolveTravelRate", () => {
  it("vrati null, ked ziadna sadzba nie je zadana", () => {
    expect(resolveTravelRate([], "2026-03-15")).toBeNull()
  })

  it("berie sadzbu platnu k DATUMU JAZDY, nie tu najnovsiu", () => {
    const stara = rate({ valid_from: "2024-01-01", valid_to: "2024-12-31", rate_per_km: 0.25 })
    const nova = rate({ valid_from: "2025-01-01", rate_per_km: 0.28 })

    expect(resolveTravelRate([stara, nova], "2024-06-01")?.rate_per_km).toBe(0.25)
    expect(resolveTravelRate([stara, nova], "2025-06-01")?.rate_per_km).toBe(0.28)
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

    expect(resolveTravelRate([zakonna, vlastna], "2026-03-15")?.rate_per_km).toBe(0.35)
    // Bez vlastnej sa pouzije zakonna.
    expect(resolveTravelRate([zakonna], "2026-03-15")?.rate_per_km).toBe(0.264)
  })

  it("pri prekryve vyhrava neskorsi zaciatok platnosti", () => {
    // Prekryv je chyba v zadani; novsia sadzba je pravdepodobnejsie ta mysleny.
    const a = rate({ valid_from: "2025-01-01", rate_per_km: 0.26 })
    const b = rate({ valid_from: "2025-07-01", rate_per_km: 0.29 })
    expect(resolveTravelRate([a, b], "2025-09-01")?.rate_per_km).toBe(0.29)
  })

  it("vlastna sadzba vyhra aj ked je starsia nez zakonna", () => {
    // Firemna dohoda plati, kym ju firma sama nezmeni — novsia zakonna sadzba
    // ju ticho neprepise.
    const zakonna = rate({ organization_id: null, valid_from: "2026-01-01", rate_per_km: 0.28 })
    const vlastna = rate({ organization_id: "org-1", valid_from: "2025-01-01", rate_per_km: 0.35 })
    expect(resolveTravelRate([zakonna, vlastna], "2026-06-01")?.rate_per_km).toBe(0.35)
  })
})
