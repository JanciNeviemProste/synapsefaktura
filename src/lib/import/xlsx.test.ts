import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { xlsxToTable, looksLikeXlsx } from "@/lib/import/xlsx"
import { contactsFromRows } from "@/lib/import/contacts"

/**
 * Skutocny .xlsx, nie mock. Harok „Klienti" ma hlavicku s diakritikou
 * a dva riadky — presne to, co pouzivatel vyexportuje z Excelu.
 */
const XLSX = readFileSync(join(__dirname, "__fixtures__", "klienti.xlsx"))

describe("looksLikeXlsx", () => {
  it("rozpozna zosit podla magickych bajtov", () => {
    // .xlsx je ZIP, teda zacina „PK".
    expect(looksLikeXlsx(new Uint8Array(XLSX))).toBe(true)
  })

  it("CSV za zosit nepovazuje", () => {
    expect(looksLikeXlsx(new TextEncoder().encode("Nazov;Mesto\nA;B"))).toBe(false)
  })

  it("nespadne na kratkom vstupe", () => {
    expect(looksLikeXlsx(new Uint8Array([0x50]))).toBe(false)
    expect(looksLikeXlsx(new Uint8Array([]))).toBe(false)
  })
})

describe("xlsxToTable", () => {
  it("precita hlavicku a riadky zo skutocneho zosita", async () => {
    const { header, rows } = await xlsxToTable(XLSX)
    // Hlavicka pride uz normalizovana — bez diakritiky a malymi pismenami.
    expect(header).toEqual(["nazov", "ico", "mesto", "e-mail", "typ"])
    expect(rows).toHaveLength(2)
    expect(rows[0][0]).toBe("Ukážka s.r.o.")
    expect(rows[1][0]).toBe("Dodávateľ a spol.")
  })

  it("cislo v bunke ostane cislom bez oddelovacov tisicov", async () => {
    // IČO „12345678" nesmie vyjst ako „12 345 678" — Excel ho drzi ako cislo.
    const { header, rows } = await xlsxToTable(XLSX)
    const ico = header.indexOf("ico")
    expect(rows[0][ico]).toBe("12345678")
  })
})

describe("XLSX a CSV davaju ROVNAKY vysledok", () => {
  it("ten isty obsah v oboch formatoch da rovnake kontakty", async () => {
    const { header, rows } = await xlsxToTable(XLSX)
    const fromXlsx = contactsFromRows(header, rows)

    const csv = [
      "Názov;IČO;Mesto;E-mail;Typ",
      "Ukážka s.r.o.;12345678;Bratislava;faktury@ukazka.sk;Odberateľ",
      "Dodávateľ a spol.;87654321;Košice;;Dodávateľ",
    ].join("\n")
    const { parseContactsTable } = await import("@/lib/import/contacts")
    const fromCsv = parseContactsTable(csv)

    // Toto je cely dovod, preco maju obe cesty zdielane jadro: keby sa
    // rozisli, pouzivatel by dostal iny vysledok podla toho, ci ulozil
    // tabulku ako CSV alebo XLSX.
    expect(fromXlsx.contacts).toEqual(fromCsv.contacts)
    expect(fromXlsx.errors).toEqual(fromCsv.errors)
  })

  it("zo zosita vznikne spravny kontakt aj s prekladom typu", async () => {
    const { header, rows } = await xlsxToTable(XLSX)
    const r = contactsFromRows(header, rows)
    expect(r.errors).toEqual([])
    expect(r.contacts[0]).toMatchObject({
      name: "Ukážka s.r.o.",
      ico: "12345678",
      city: "Bratislava",
      email: "faktury@ukazka.sk",
      type: "customer",
      country: "SK",
    })
    expect(r.contacts[1]).toMatchObject({
      name: "Dodávateľ a spol.",
      type: "supplier",
    })
    // Prazdna bunka e-mailu nesmie vyrobit chybu.
    expect(r.contacts[1].email).toBeUndefined()
  })
})
