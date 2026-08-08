import { describe, it, expect } from "vitest"
import { parseEnabledProviders } from "@/lib/auth/providers"

describe("parseEnabledProviders", () => {
  it("vráti len tie, ktoré sú naozaj zapnuté", () => {
    expect(
      parseEnabledProviders({
        external: { email: true, google: true, github: false, apple: false },
      }),
    ).toEqual(["email", "google"])
  })

  it("vypnutý Google sa medzi nimi neocitne", () => {
    // Presne stav produkcie v čase písania: tlačidlo viedlo na surový JSON.
    const p = parseEnabledProviders({
      external: { email: true, google: false },
    })
    expect(p).not.toContain("google")
  })

  it("neznámy tvar odpovede berie ako „nič nie je zapnuté“", () => {
    // Radšej tlačidlo neukázať než ukázať pokazené.
    expect(parseEnabledProviders({})).toEqual([])
    expect(parseEnabledProviders({ external: null })).toEqual([])
    expect(parseEnabledProviders({ external: "google" })).toEqual([])
    expect(parseEnabledProviders(null)).toEqual([])
    expect(parseEnabledProviders("chyba")).toEqual([])
  })

  it("neberie hodnoty, ktoré len vyzerajú pravdivo", () => {
    // `"false"` aj `1` sú v JS pravdivé — tu by to znamenalo pokazené tlačidlo.
    expect(
      parseEnabledProviders({
        external: { google: "false", apple: 1, azure: {} },
      }),
    ).toEqual([])
  })
})
