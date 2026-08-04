import { describe, it, expect } from "vitest"
import {
  MIN_NAME_MATCH_SCORE,
  matchContactByName,
  nameCore,
  normalizeName,
  scoreNameMatch,
} from "./match-name"

describe("normalizeName / nameCore", () => {
  it("zahodí diakritiku, veľkosť písmen a interpunkciu", () => {
    expect(normalizeName("Ľubovňa, s. r. o.")).toBe("lubovna s r o")
    expect(normalizeName("  ŠTÝL  ")).toBe("styl")
  })

  it("jadro je prázdne pri samotnej právnej forme alebo jednom písmene", () => {
    expect(nameCore("s.r.o.")).toBe("")
    expect(nameCore("a")).toBe("")
    expect(nameCore("a. s.")).toBe("")
    expect(nameCore("Alfa s.r.o.")).toBe("alfa")
  })
})

describe("scoreNameMatch", () => {
  it("presná zhoda má najvyššie skóre", () => {
    expect(scoreNameMatch("Alfa s.r.o.", "Alfa s.r.o.")).toBe(1)
    expect(scoreNameMatch("Alfa s.r.o.", "alfa, s. r. o.")).toBe(1)
  })

  it("zhoda jadier ignoruje právnu formu", () => {
    expect(scoreNameMatch("Alfa s.r.o.", "Alfa a.s.")).toBe(0.9)
  })

  it("nájde názov ako celé slovo vo vete", () => {
    expect(
      scoreNameMatch(
        "Alfa s.r.o.",
        "Vystav faktúru pre Alfa s.r.o. na 100 eur",
      ),
    ).toBeGreaterThanOrEqual(MIN_NAME_MATCH_SCORE)
    expect(
      scoreNameMatch("Alfa Trade s.r.o.", "faktúra pre Alfa Trade dnes"),
    ).toBe(0.8)
  })

  it("NEPÁRUJE generický názov s ľubovoľnou vetou", () => {
    const veta = "Vystav faktúru pre Alfa s.r.o. za konzultácie na 100 eur"
    expect(scoreNameMatch("a", veta)).toBe(0)
    expect(scoreNameMatch("s.r.o.", veta)).toBe(0)
    expect(scoreNameMatch("a. s.", veta)).toBe(0)
    expect(scoreNameMatch("spol. s r.o.", veta)).toBe(0)
  })

  it("NEPÁRUJE krátky podreťazec cudzieho názvu", () => {
    expect(scoreNameMatch("Alfatechnológie", "Alfa")).toBe(0)
    expect(scoreNameMatch("Beta", "Alfa")).toBe(0)
    expect(scoreNameMatch("", "Alfa")).toBe(0)
  })

  it("podreťazec prejde až pri dostatočnej dĺžke a pokrytí", () => {
    // "konzultacie" je 11 znakov v 12-znakovom názve → nad prahom 60 %
    expect(scoreNameMatch("KonzultacieX", "konzultacie")).toBe(0.6)
  })
})

describe("matchContactByName", () => {
  const contacts = [
    { id: "1", name: "a" },
    { id: "2", name: "s.r.o." },
    { id: "3", name: "Trade" },
    { id: "4", name: "Alfa Trade s.r.o." },
  ]

  it("radšej nevráti nič, než by trafil cudziu firmu", () => {
    expect(matchContactByName(contacts, "Omega Consulting")).toBeNull()
    expect(matchContactByName(contacts, null)).toBeNull()
    expect(matchContactByName(contacts, "")).toBeNull()
  })

  it("pri rovnakom skóre vyhráva konkrétnejší (dlhší) názov, nie prvý", () => {
    const match = matchContactByName(
      contacts,
      "Faktúra pre Alfa Trade s.r.o. za konzultácie",
    )
    expect(match?.id).toBe("4")
  })

  it("nájde kontakt aj podľa holého názvu bez právnej formy", () => {
    expect(matchContactByName(contacts, "Alfa Trade")?.id).toBe("4")
  })
})
