import { describe, it, expect } from "vitest"
import {
  buildAccountingItemsCsv,
  type ExportInvoiceItem,
} from "@/lib/export/accounting"

function item(p: Partial<ExportInvoiceItem> = {}): ExportInvoiceItem {
  return {
    documentNumber: "20260001",
    issueDate: "2026-03-01",
    supplyDate: "2026-03-01",
    contactName: "Odberateľ s.r.o.",
    contactIco: "12345678",
    description: "Konzultácie",
    quantity: 2,
    unit: "h",
    unitPrice: 50,
    vatRate: 23,
    lineBase: 100,
    lineVat: 23,
    lineTotal: 123,
    currency: "EUR",
    accountCode: "602",
    costCenter: "BA",
    projectCode: "P-2026-01",
    activityCode: "SLU",
    ...p,
  }
}

describe("buildAccountingItemsCsv", () => {
  it("nesie uctovne clenenie — to je cely dovod tohto exportu", () => {
    const csv = buildAccountingItemsCsv([item()])
    const [header, row] = csv.split("\r\n")

    expect(header).toContain("Účet")
    expect(header).toContain("Stredisko")
    expect(header).toContain("Zákazka")
    expect(header).toContain("Činnosť")

    expect(row).toContain("602")
    expect(row).toContain("BA")
    expect(row).toContain("P-2026-01")
    expect(row).toContain("SLU")
  })

  it("nevyplnene clenenie ostane prazdne, nie 'null'", () => {
    const csv = buildAccountingItemsCsv([
      item({
        accountCode: null,
        costCenter: null,
        projectCode: null,
        activityCode: null,
      }),
    ])
    expect(csv).not.toContain("null")
    // Styri prazdne stlpce na konci riadku.
    expect(csv.split("\r\n")[1].endsWith("EUR;;;;")).toBe(true)
  })

  it("zacina BOM, aby Excel precital diakritiku", () => {
    expect(buildAccountingItemsCsv([]).startsWith("﻿")).toBe(true)
  })

  it("escapuje bodkociarku aj uvodzovky v popise", () => {
    const csv = buildAccountingItemsCsv([
      item({ description: 'Práce; "extra"' }),
    ])
    expect(csv).toContain('"Práce; ""extra"""')
    // Escapovana bunka nesmie rozbit pocet stlpcov.
    expect(csv.split("\r\n")).toHaveLength(2)
  })

  it("sumy maju pevny pocet desatinnych miest", () => {
    const csv = buildAccountingItemsCsv([
      item({ lineBase: 100, lineVat: 23, lineTotal: 123, unitPrice: 50 }),
    ])
    const row = csv.split("\r\n")[1]
    expect(row).toContain("50.0000")
    expect(row).toContain("100.00")
    expect(row).toContain("23.00")
    expect(row).toContain("123.00")
  })

  it("prazdny export vrati samotnu hlavicku", () => {
    const csv = buildAccountingItemsCsv([])
    expect(csv.split("\r\n")).toHaveLength(1)
  })
})
