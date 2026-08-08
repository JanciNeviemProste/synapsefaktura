import { describe, it, expect } from "vitest"
import {
  parseStatutoryRates,
  isNewerStatutoryRate,
} from "@/lib/logbook/rate-source"

/**
 * Skratena, ale VERNA podoba stranky MPSVR "Upozornenie — zvysenie sum
 * zakladnej nahrady" (stiahnute 5. 8. 2026). Zamerne si drzi tri vlastnosti,
 * na ktorych prvy pokus o parser stroskotal:
 *
 *  1. sumy su uvedene ako ZMENA "z 0,085 na 0,090" — brat prve cislo za
 *     popiskom by dalo STARU sadzbu,
 *  2. su tu STYRI cisla predpisov: zakon, jeho novela, predchadzajuce
 *     oznamenie a az potom to nove,
 *  3. cislo noveho oznamenia ma na stranke ODSEKNUTU koncovku ("c. 340/2025 Z."),
 *  4. spomina sa aj stara ucinnost "od 1. juna 2025", ktora je v texte SKOR
 *     nez ta nova.
 */
const PAGE = `
<html><body>
<h1>Upozornenie na zv&yacute;&scaron;enie s&uacute;m z&aacute;kladnej n&aacute;hrady
    &ndash; &uacute;činnosť od 1. janu&aacute;ra 2026</h1>
<p>Sumy z&aacute;kladnej n&aacute;hrady boli naposledy zverejnen&eacute; ozn&aacute;men&iacute;m
   Ministerstva pr&aacute;ce, soci&aacute;lnych vec&iacute; a rodiny Slovenskej republiky
   č. 97/2025 Z. z., ktor&eacute; sa začali uplatňovať od 1. j&uacute;na 2025.</p>
<p>Sumy z&aacute;kladnej n&aacute;hrady určen&eacute; podľa &sect; 8 ods. 2 z&aacute;kona
   č. 283/2002 Z. z. o cestovn&yacute;ch n&aacute;hrad&aacute;ch v znen&iacute; z&aacute;kona
   č. 297/2024 Z. z. sa zv&yacute;&scaron;ia nasledovne:</p>
<ul>
  <li>pre jednostopov&eacute; vozidl&aacute; a trojkolky z 0,085 eura/km na 0,090 eura/km,</li>
  <li>pre osobn&eacute; cestn&eacute; motorov&eacute; vozidl&aacute; z 0,296 eura/km na 0,313 eura/km.</li>
</ul>
<p>Zv&yacute;&scaron;en&eacute; sumy z&aacute;kladnej n&aacute;hrady sa bud&uacute; uplatňovať
   od 1. janu&aacute;ra 2026. S&uacute; zverejnen&eacute; v ozn&aacute;men&iacute;
   Ministerstva pr&aacute;ce, soci&aacute;lnych vec&iacute; a rodiny Slovenskej republiky
   č. 340/2025 Z.</p>
</body></html>
`

describe("parseStatutoryRates", () => {
  it("vycita NOVE sadzby, datum aj cislo noveho oznamenia", () => {
    const res = parseStatutoryRates(PAGE)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.rates).toEqual({
      validFrom: "2026-01-01",
      sourceRef: "340/2025 Z. z.",
      passenger: 0.313,
      motorcycle: 0.09,
    })
  })

  it("neberie STARU sadzbu z tvaru 'z X na Y'", () => {
    const res = parseStatutoryRates(PAGE)
    if (!res.ok) throw new Error(res.reason)
    // 0,296 a 0,085 su predchadzajuce sumy — nesmu prejst.
    expect(res.rates.passenger).not.toBe(0.296)
    expect(res.rates.motorcycle).not.toBe(0.085)
  })

  it("neberie cislo PREDCHADZAJUCEHO oznamenia ani cislo zakona", () => {
    const res = parseStatutoryRates(PAGE)
    if (!res.ok) throw new Error(res.reason)
    expect(res.rates.sourceRef).not.toContain("97/2025")
    expect(res.rates.sourceRef).not.toContain("283/2002")
    expect(res.rates.sourceRef).not.toContain("297/2024")
  })

  it("neberie STARU ucinnost, aj ked je v texte skor", () => {
    const res = parseStatutoryRates(PAGE)
    if (!res.ok) throw new Error(res.reason)
    expect(res.rates.validFrom).toBe("2026-01-01")
  })

  it("zvladne aj jednoduchy tvar bez 'z X na Y'", () => {
    // Tak sumy uvadza Narodny inspektorat prace.
    const nip = `
      <p>Podľa ozn&aacute;menia č. 340/2025 Z. z. s&uacute; sumy od 1. janu&aacute;ra 2026:</p>
      <ul>
        <li>dvojkolesov&eacute; a trojkolesov&eacute; vozidl&aacute;, &scaron;tvorkolky: 0,090 eura</li>
        <li>osobn&eacute; vozidl&aacute;: 0,313 eura</li>
      </ul>`
    const res = parseStatutoryRates(nip)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.rates.passenger).toBe(0.313)
    expect(res.rates.motorcycle).toBe(0.09)
  })

  it("odmietne stranku bez cisla oznamenia", () => {
    const res = parseStatutoryRates(
      PAGE.replace(/ozn&aacute;men\w*/g, "predpis"),
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("číslo oznámenia")
  })

  it("odmietne stranku bez datumu ucinnosti", () => {
    const res = parseStatutoryRates(
      PAGE.replace(/od 1\. j[^<,.]*\d{4}/g, "neskôr"),
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("dátum účinnosti")
  })

  it("odmietne, ked sa sadzba neda priradit ku kategorii", () => {
    const res = parseStatutoryRates(
      PAGE.replace(/jednostopov\w*/g, "ine").replace(/osobn&eacute;/g, "ine"),
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("priradiť ku kategórii")
  })

  it("odmietne nezmyselne vysoku sadzbu", () => {
    const res = parseStatutoryRates(
      PAGE.replace("na 0,313 eura", "na 9,999 eura"),
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("mimo rozsahu")
  })

  it("odmietne, ked osobne vozidlo nema vyssiu sadzbu nez jednostopove", () => {
    const res = parseStatutoryRates(
      PAGE.replace("na 0,313 eura", "na 0,090 eura"),
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("nie je vyššia")
  })

  it("odmietne prazdny vstup", () => {
    expect(parseStatutoryRates("").ok).toBe(false)
  })
})

describe("isNewerStatutoryRate", () => {
  const found = {
    validFrom: "2026-07-01",
    sourceRef: "500/2026 Z. z.",
    passenger: 0.33,
    motorcycle: 0.095,
  }
  const current = {
    validFrom: "2026-01-01",
    passenger: 0.313,
    sourceRef: "340/2025 Z. z.",
  }

  it("bez existujucej sadzby je vzdy novsia", () => {
    expect(isNewerStatutoryRate(found, null).ok).toBe(true)
  })

  it("prijme skutocne novsiu sadzbu", () => {
    expect(isNewerStatutoryRate(found, current).ok).toBe(true)
  })

  it("nic nerobi pri rovnakom predpise", () => {
    const res = isNewerStatutoryRate(
      { ...found, sourceRef: "340/2025 Z. z." },
      current,
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("nezmenila")
  })

  it("odmietne starsiu ucinnost", () => {
    const res = isNewerStatutoryRate(
      { ...found, validFrom: "2025-01-01" },
      current,
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("nie je novšia")
  })

  it("ODMIETNE NIZSIU sadzbu — zakon sadzbu neznizuje, takze ide o chybu", () => {
    // Najsilnejsia poistka: keby sa stranka prekopala a parser chytil ine
    // cislo, skoro urcite bude nizsie.
    const res = isNewerStatutoryRate({ ...found, passenger: 0.09 }, current)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toContain("NIŽŠIA")
  })
})
