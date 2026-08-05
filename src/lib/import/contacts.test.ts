import { describe, it, expect } from "vitest"
import { parseContactsTable } from "@/lib/import/contacts"

describe("parseContactsTable", () => {
  it("prečíta slovenskú hlavičku s diakritikou a bodkočiarkou", () => {
    // Presne to, co vyexportuje slovensky Excel.
    const csv = [
      "Názov;IČO;Mesto;E-mail",
      "Ukážka s.r.o.;12345678;Bratislava;faktury@ukazka.sk",
    ].join("\n")
    const r = parseContactsTable(csv)
    expect(r.errors).toEqual([])
    expect(r.contacts).toHaveLength(1)
    expect(r.contacts[0]).toMatchObject({
      name: "Ukážka s.r.o.",
      ico: "12345678",
      city: "Bratislava",
      email: "faktury@ukazka.sk",
      country: "SK",
      type: "customer",
    })
  })

  it("zvládne čiarku aj tabulátor ako oddeľovač", () => {
    expect(parseContactsTable("Nazov,Mesto\nFirma,Nitra").contacts[0]).toMatchObject({
      name: "Firma",
      city: "Nitra",
    })
    expect(parseContactsTable("Nazov\tMesto\nFirma\tNitra").contacts[0]).toMatchObject({
      name: "Firma",
      city: "Nitra",
    })
  })

  it("nenechá sa rozhodiť BOM na začiatku súboru", () => {
    // Bez osetrenia by sa prva hlavicka volala "﻿Nazov" a stlpec by sa
    // nenasiel — typicky priznak "Excel to ulozil ako UTF-8 s BOM".
    const r = parseContactsTable("﻿Názov;Mesto\nFirma;Žilina")
    expect(r.contacts[0]?.name).toBe("Firma")
  })

  it("rešpektuje úvodzovky, keď je v hodnote oddeľovač", () => {
    const r = parseContactsTable('Názov;Ulica\nFirma;"Hlavná 1; vchod B"')
    expect(r.contacts[0].street).toBe("Hlavná 1; vchod B")
  })

  it("nájde stĺpec aj v dlhšej hlavičke", () => {
    const r = parseContactsTable("Obchodné meno;IČO odberateľa\nFirma;111")
    expect(r.contacts[0]).toMatchObject({ name: "Firma", ico: "111" })
  })

  it("preloží slovenský aj anglický typ kontaktu", () => {
    const csv = [
      "Nazov;Typ",
      "A;Odberateľ",
      "B;Dodávateľ",
      "C;Obojaké",
      "D;supplier",
      "E;",
    ].join("\n")
    const types = parseContactsTable(csv).contacts.map((c) => c.type)
    expect(types).toEqual(["customer", "supplier", "both", "supplier", "customer"])
  })

  it("odmietne tabuľku bez stĺpca s názvom", () => {
    const r = parseContactsTable("IČO;Mesto\n123;Trnava")
    expect(r.contacts).toEqual([])
    expect(r.errors[0]).toContain("chýba stĺpec")
  })

  it("preskočí riadok bez názvu a povie číslo riadku", () => {
    const r = parseContactsTable("Nazov;Mesto\n;Trnava\nFirma;Nitra")
    expect(r.contacts).toHaveLength(1)
    expect(r.errors[0]).toContain("Riadok 2")
  })

  it("preskočí duplicitu v rámci súboru", () => {
    const r = parseContactsTable("Nazov\nFirma\n  firma  ")
    expect(r.contacts).toHaveLength(1)
    expect(r.errors[0]).toContain("viackrát")
  })

  it("nesprávny e-mail kontakt nezhodí, len sa neuloží", () => {
    const r = parseContactsTable("Nazov;Email\nFirma;toto-nie-je-mail")
    expect(r.contacts).toHaveLength(1)
    expect(r.contacts[0].email).toBeUndefined()
    expect(r.errors[0]).toContain("nevyzerá ako e-mail")
  })

  it("vymenuje stĺpce, ktorým nerozumie", () => {
    const r = parseContactsTable("Nazov;Zlava;Splatnost\nFirma;10;14")
    expect(r.contacts).toHaveLength(1)
    expect(r.ignoredColumns).toContain("zlava")
  })

  it("doplní krajinu na SK, keď stĺpec chýba", () => {
    expect(parseContactsTable("Nazov\nFirma").contacts[0].country).toBe("SK")
  })

  it("prázdny súbor je chyba, nie pád", () => {
    const r = parseContactsTable("")
    expect(r.contacts).toEqual([])
    expect(r.errors).toHaveLength(1)
  })

  it("zvládne kratší riadok než hlavička", () => {
    const r = parseContactsTable("Nazov;Mesto;Email\nFirma;Nitra")
    expect(r.contacts[0]).toMatchObject({ name: "Firma", city: "Nitra" })
    expect(r.contacts[0].email).toBeUndefined()
  })
})
