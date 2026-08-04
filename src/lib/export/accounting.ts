/**
 * Accounting exports for the user's accountant (CSV + simple XML). Format mirrors
 * the columns SuperFaktúra hands over; the accountant maps it into their system.
 */

export interface ExportInvoice {
  number: string | null
  issue_date: string | null
  supply_date: string | null
  due_date: string | null
  currency: string
  subtotal: number
  vat_total: number
  total: number
  status: string
  vat_mode: string
  contactName: string | null
  contactIco: string | null
  contactIcDph: string | null
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildAccountingCsv(invoices: ExportInvoice[]): string {
  const header = [
    "Číslo",
    "Dátum vystavenia",
    "Dátum dodania",
    "Splatnosť",
    "Odberateľ",
    "IČO",
    "IČ DPH",
    "Základ",
    "DPH",
    "Spolu",
    "Mena",
    "Režim DPH",
    "Stav",
  ]
  const lines = [header.join(";")]
  for (const i of invoices) {
    lines.push(
      [
        i.number,
        i.issue_date,
        i.supply_date,
        i.due_date,
        i.contactName,
        i.contactIco,
        i.contactIcDph,
        i.subtotal.toFixed(2),
        i.vat_total.toFixed(2),
        i.total.toFixed(2),
        i.currency,
        i.vat_mode,
        i.status,
      ]
        .map(csvCell)
        .join(";"),
    )
  }
  // BOM so Excel reads UTF-8 correctly.
  return "﻿" + lines.join("\r\n")
}

/**
 * Riadok položkového exportu — účtovné členenie sedí na položke, nie na
 * hlavičke, takže hlavičkový export ho nemá kam dať.
 */
export interface ExportInvoiceItem {
  documentNumber: string | null
  issueDate: string | null
  supplyDate: string | null
  contactName: string | null
  contactIco: string | null
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
  lineBase: number
  lineVat: number
  lineTotal: number
  currency: string
  accountCode: string | null
  costCenter: string | null
  projectCode: string | null
  activityCode: string | null
}

/**
 * Položkový export do účtovníctva (Pohoda, Omega a spol.).
 *
 * Hlavičkový export nesie sumy za celý doklad, takže účtovník z neho nevie,
 * na aký účet, stredisko či zákazku riadok patrí. Tie stĺpce v `document_items`
 * existovali, ale nikto ich nečítal — tento export je to miesto, kde sa
 * uplatnia.
 */
export function buildAccountingItemsCsv(items: ExportInvoiceItem[]): string {
  const header = [
    "Číslo dokladu",
    "Dátum vystavenia",
    "Dátum dodania",
    "Odberateľ",
    "IČO",
    "Popis položky",
    "Množstvo",
    "MJ",
    "Cena/MJ",
    "Sadzba DPH",
    "Základ",
    "DPH",
    "Spolu",
    "Mena",
    "Účet",
    "Stredisko",
    "Zákazka",
    "Činnosť",
  ]
  const lines = [header.join(";")]
  for (const i of items) {
    lines.push(
      [
        i.documentNumber,
        i.issueDate,
        i.supplyDate,
        i.contactName,
        i.contactIco,
        i.description,
        i.quantity,
        i.unit,
        i.unitPrice.toFixed(4),
        i.vatRate,
        i.lineBase.toFixed(2),
        i.lineVat.toFixed(2),
        i.lineTotal.toFixed(2),
        i.currency,
        i.accountCode,
        i.costCenter,
        i.projectCode,
        i.activityCode,
      ]
        .map(csvCell)
        .join(";"),
    )
  }
  // BOM so Excel reads UTF-8 correctly.
  return "﻿" + lines.join("\r\n")
}

export function buildAccountingXml(invoices: ExportInvoice[]): string {
  const items = invoices
    .map(
      (i) => `  <invoice>
    <number>${xmlEscape(i.number ?? "")}</number>
    <issueDate>${i.issue_date ?? ""}</issueDate>
    <supplyDate>${i.supply_date ?? ""}</supplyDate>
    <dueDate>${i.due_date ?? ""}</dueDate>
    <customer>${xmlEscape(i.contactName ?? "")}</customer>
    <ico>${xmlEscape(i.contactIco ?? "")}</ico>
    <icDph>${xmlEscape(i.contactIcDph ?? "")}</icDph>
    <base>${i.subtotal.toFixed(2)}</base>
    <vat>${i.vat_total.toFixed(2)}</vat>
    <total>${i.total.toFixed(2)}</total>
    <currency>${i.currency}</currency>
    <vatMode>${i.vat_mode}</vatMode>
    <status>${i.status}</status>
  </invoice>`,
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<invoices>\n${items}\n</invoices>\n`
}
