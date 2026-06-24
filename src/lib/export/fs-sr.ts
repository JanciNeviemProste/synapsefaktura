import type { ExportInvoice } from "./accounting"

/**
 * Finančná správa SR XML exports — Kontrolný výkaz DPH and Súhrnný výkaz.
 *
 * ⚠️ TODO: verify against the official FS SR XSD schemas before production. The
 * element names and structure below follow the documented layout but the
 * authoritative schema (eDane / FS SR) must be matched exactly. Treat these as
 * a structural starting point, not a certified export.
 */

export interface ExportOrg {
  name: string
  ico: string | null
  dic: string | null
  icDph: string | null
}

export interface ExportPeriod {
  year: number
  month: number // 1–12
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Kontrolný výkaz DPH. Section A1 = issued invoices to VAT payers (domestic,
 * standard regime). TODO: verify schema + add A2/B/C/D sections per FS SR.
 */
export function buildKontrolnyVykaz(
  org: ExportOrg,
  invoices: ExportInvoice[],
  period: ExportPeriod,
): string {
  const a1 = invoices
    .filter((i) => i.vat_mode === "payer" && i.contactIcDph)
    .map(
      (i) => `      <veta>
        <ic_dph_odberatela>${esc(i.contactIcDph ?? "")}</ic_dph_odberatela>
        <cislo_faktury>${esc(i.number ?? "")}</cislo_faktury>
        <datum_dodania>${i.supply_date ?? i.issue_date ?? ""}</datum_dodania>
        <zaklad_dane>${i.subtotal.toFixed(2)}</zaklad_dane>
        <dan>${i.vat_total.toFixed(2)}</dan>
      </veta>`,
    )
    .join("\n")

  // TODO: verify root element + namespace against FS SR Kontrolný výkaz XSD.
  return `<?xml version="1.0" encoding="UTF-8"?>
<KControlnyVykazDPH>
  <Identifikacia>
    <IcDph>${esc(org.icDph ?? "")}</IcDph>
    <Nazov>${esc(org.name)}</Nazov>
    <Obdobie rok="${period.year}" mesiac="${period.month}" />
  </Identifikacia>
  <A1>
${a1}
  </A1>
</KControlnyVykazDPH>
`
}

/**
 * Súhrnný výkaz — intra-EU B2B supplies grouped by the customer's VAT id.
 * TODO: verify schema; add triangulation / service flags per FS SR.
 */
export function buildSuhrnnyVykaz(
  org: ExportOrg,
  invoices: ExportInvoice[],
  period: ExportPeriod,
): string {
  const byVat = new Map<string, number>()
  for (const i of invoices) {
    if (i.vat_mode !== "intra_eu_b2b" || !i.contactIcDph) continue
    byVat.set(i.contactIcDph, (byVat.get(i.contactIcDph) ?? 0) + i.total)
  }
  const rows = [...byVat.entries()]
    .map(
      ([vat, sum]) => `      <veta>
        <ic_dph_nadobudatela>${esc(vat)}</ic_dph_nadobudatela>
        <hodnota>${sum.toFixed(2)}</hodnota>
        <kod_plnenia>0</kod_plnenia>
      </veta>`,
    )
    .join("\n")

  // TODO: verify root element + namespace against FS SR Súhrnný výkaz XSD.
  return `<?xml version="1.0" encoding="UTF-8"?>
<SuhrnnyVykaz>
  <Identifikacia>
    <IcDph>${esc(org.icDph ?? "")}</IcDph>
    <Nazov>${esc(org.name)}</Nazov>
    <Obdobie rok="${period.year}" stvrtrok="${Math.ceil(period.month / 3)}" />
  </Identifikacia>
  <Plnenia>
${rows}
  </Plnenia>
</SuhrnnyVykaz>
`
}
