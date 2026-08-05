import { describe, it, expect } from "vitest"
import { revealedCount, totalDurationMs } from "@/lib/landing/typewriter"
import { nextScrubTime, isSeekWorthwhile } from "@/lib/landing/scrub"

describe("revealedCount", () => {
  it("pred uplynutím oneskorenia neukáže nič", () => {
    expect(revealedCount(0, 50)).toBe(0)
    expect(revealedCount(599, 50)).toBe(0)
  })

  it("odhaľuje znak po znaku", () => {
    // 600 ms oneskorenie + 38 ms na znak
    expect(revealedCount(600 + 38, 50)).toBe(1)
    expect(revealedCount(600 + 38 * 10, 50)).toBe(10)
  })

  it("NIKDY nepretečie dĺžku textu", () => {
    // Toto by v UI znamenalo `slice` za koncom a blikajúci kurzor navždy.
    expect(revealedCount(999_999, 12)).toBe(12)
  })

  it("prázdny text nespadne", () => {
    expect(revealedCount(5000, 0)).toBe(0)
  })

  it("nezmyselný vstup nedá NaN", () => {
    expect(revealedCount(Number.NaN, 10)).toBe(0)
    expect(revealedCount(5000, 10, 0)).toBe(10)
    expect(revealedCount(5000, 10, -5)).toBe(10)
  })
})

describe("totalDurationMs", () => {
  it("počíta oneskorenie aj písanie", () => {
    expect(totalDurationMs(10)).toBe(600 + 380)
  })

  it("prázdny text skončí hneď po oneskorení", () => {
    expect(totalDurationMs(0)).toBe(600)
  })
})

describe("nextScrubTime", () => {
  it("posun doprava posúva video dopredu", () => {
    // 1000 px okno, posun o 500 px = pol obrazovky.
    // 0,5 * 0,8 * 4 s = 1,6 s
    expect(nextScrubTime(0, 500, 1000, 4)).toBeCloseTo(1.6, 5)
  })

  it("posun doľava ide dozadu", () => {
    expect(nextScrubTime(2, -500, 1000, 4)).toBeCloseTo(0.4, 5)
  })

  it("nepustí za začiatok ani za koniec", () => {
    // Bez orezania by prehliadač seek odmietol a video by zamrzlo.
    expect(nextScrubTime(0.1, -5000, 1000, 4)).toBe(0)
    expect(nextScrubTime(3.9, 5000, 1000, 4)).toBe(4)
  })

  it("nenačítané video nechá čas tak", () => {
    // `duration` je NaN, kým sa metadáta nenačítajú.
    expect(nextScrubTime(1.5, 300, 1000, Number.NaN)).toBe(1.5)
    expect(nextScrubTime(1.5, 300, 1000, 0)).toBe(1.5)
  })

  it("nulová šírka okna nedá delenie nulou", () => {
    expect(nextScrubTime(1, 300, 0, 4)).toBe(1)
  })

  it("nikdy nevráti NaN", () => {
    for (const d of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 4]) {
      for (const dx of [Number.NaN, -1e9, 0, 1e9]) {
        expect(Number.isNaN(nextScrubTime(1, dx, 1000, d))).toBe(false)
      }
    }
  })
})

describe("isSeekWorthwhile", () => {
  it("mikroposun preskočí", () => {
    // Bez tohto by sa seeky zahltili a obraz by zamrzol.
    expect(isSeekWorthwhile(1, 1.005)).toBe(false)
  })

  it("badateľný posun pustí", () => {
    expect(isSeekWorthwhile(1, 1.2)).toBe(true)
    expect(isSeekWorthwhile(1.2, 1)).toBe(true)
  })

  it("nezmyselný vstup neseekuje", () => {
    expect(isSeekWorthwhile(Number.NaN, 1)).toBe(false)
    expect(isSeekWorthwhile(1, Number.NaN)).toBe(false)
  })
})
