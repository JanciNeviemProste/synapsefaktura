import { describe, expect, it } from "vitest"

import type { Database } from "@/lib/supabase/database.types"
import { buildUblInvoice, serializeUbl, toUblModel } from "@/lib/peppol/ubl"

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type DocumentItemRow = Database["public"]["Tables"]["document_items"]["Row"]
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"]
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
type BankAccountRow = Database["public"]["Tables"]["bank_accounts"]["Row"]
type VatMode = Database["public"]["Enums"]["vat_mode"]

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOrganization(
  overrides: Partial<OrganizationRow> = {},
): OrganizationRow {
  return {
    city: "Bratislava",
    country: "SK",
    created_at: "2026-01-01T00:00:00Z",
    default_currency: "EUR",
    default_due_days: 14,
    default_language: "sk",
    dic: "2020317068",
    digital_postman_provider: null,
    einvoice_enabled: true,
    ic_dph: "SK2020317068",
    ico: "35757442",
    id: "org-1",
    is_vat_payer: true,
    legal_form: "s.r.o.",
    logo_url: null,
    name: "Dodávateľ s.r.o.",
    peppol_id: "0245:2020317068",
    postal_code: "81101",
    signature_url: null,
    stamp_url: null,
    street: "Hlavná 1",
    updated_at: "2026-01-01T00:00:00Z",
    vat_mode_default: "payer",
    ...overrides,
  }
}

function makeContact(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    city: "Košice",
    country: "SK",
    created_at: "2026-01-01T00:00:00Z",
    default_due_days: 14,
    dic: "2021234567",
    email: "odberatel@example.sk",
    ic_dph: "SK2021234567",
    ico: "12345678",
    id: "contact-1",
    name: "Odberateľ a.s.",
    notes: null,
    organization_id: "org-1",
    payment_behavior_score: null,
    peppol_id: "0245:2021234567",
    phone: null,
    postal_code: "04001",
    street: "Mlynská 5",
    type: "customer",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeBankAccount(
  overrides: Partial<BankAccountRow> = {},
): BankAccountRow {
  return {
    bank_name: "Tatra banka",
    created_at: "2026-01-01T00:00:00Z",
    currency: "EUR",
    iban: "SK3112000000198742637541",
    id: "bank-1",
    is_default: true,
    organization_id: "org-1",
    swift: "TATRSKBX",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeDocument(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    contact_id: "contact-1",
    created_at: "2026-01-01T00:00:00Z",
    created_by: null,
    currency: "EUR",
    due_date: "2026-07-09",
    exchange_rate: 1,
    footer_notes: null,
    id: "doc-1",
    issue_date: "2026-06-25",
    language: "sk",
    legal_notes: null,
    notes: null,
    number: "2026001",
    organization_id: "org-1",
    paid_amount: 0,
    pdf_url: null,
    related_document_id: null,
    sequence_id: null,
    source: "manual",
    status: "issued",
    subtotal: 0,
    supply_date: "2026-06-25",
    total: 0,
    type: "invoice",
    updated_at: "2026-01-01T00:00:00Z",
    vat_mode: "payer",
    vat_total: 0,
    ...overrides,
  }
}

function makeItem(overrides: Partial<DocumentItemRow> = {}): DocumentItemRow {
  return {
    created_at: "2026-01-01T00:00:00Z",
    description: "Položka",
    discount_pct: 0,
    document_id: "doc-1",
    id: crypto.randomUUID(),
    line_base: 0,
    line_total: 0,
    line_vat: 0,
    position: 0,
    product_id: null,
    quantity: 1,
    unit: "ks",
    unit_price: 0,
    vat_rate: 23,
    ...overrides,
  }
}

/**
 * Payer faktúra: 2 riadky @ 23 % a 1 riadok @ 0 %. Sumy sú už zaokrúhlené —
 * subtotal/vat_total/total sú odvodené z line_* hodnôt.
 */
function payerFixture() {
  const items: DocumentItemRow[] = [
    makeItem({
      position: 0,
      description: "Konzultácie",
      quantity: 10,
      unit: "hod",
      unit_price: 50,
      vat_rate: 23,
      line_base: 500,
      line_vat: 115,
      line_total: 615,
    }),
    makeItem({
      position: 1,
      description: "Licencia softvéru",
      quantity: 1,
      unit: "ks",
      unit_price: 200,
      vat_rate: 23,
      line_base: 200,
      line_vat: 46,
      line_total: 246,
    }),
    makeItem({
      position: 2,
      description: "Zľavnená služba",
      quantity: 1,
      unit: "ks",
      unit_price: 100,
      vat_rate: 0,
      line_base: 100,
      line_vat: 0,
      line_total: 100,
    }),
  ]
  const subtotal = 800
  const vatTotal = 161
  const total = 961
  const document = makeDocument({
    vat_mode: "payer",
    subtotal,
    vat_total: vatTotal,
    total,
  })
  return {
    document,
    items,
    organization: makeOrganization(),
    contact: makeContact(),
    bankAccount: makeBankAccount(),
  }
}

// ── Helpers na parsovanie XML ────────────────────────────────────────────────

function matchAll(xml: string, re: RegExp): string[] {
  return Array.from(xml.matchAll(re)).map((m) => m[1])
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("serializeUbl — payer invoice", () => {
  const { xml } = buildUblInvoice(payerFixture())

  it("includes CustomizationID and ProfileID", () => {
    expect(xml).toContain(
      "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0",
    )
    expect(xml).toContain(
      "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    )
  })

  it("starts with the XML prolog and Invoice namespaces", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain(
      'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    )
  })

  it("emits the invoice number as cbc:ID and both EndpointID schemeID=0245", () => {
    expect(xml).toContain("<cbc:ID>2026001</cbc:ID>")
    const endpoints = matchAll(
      xml,
      /<cbc:EndpointID schemeID="0245">([^<]+)<\/cbc:EndpointID>/g,
    )
    expect(endpoints).toHaveLength(2)
    expect(endpoints).toContain("2020317068")
    expect(endpoints).toContain("2021234567")
  })

  it("emits one cac:InvoiceLine per item", () => {
    const count = matchAll(xml, /(<cac:InvoiceLine>)/g).length
    expect(count).toBe(payerFixture().items.length)
  })

  it("PayableAmount equals total.toFixed(2)", () => {
    const payable = xml.match(
      /<cbc:PayableAmount currencyID="EUR">([^<]+)<\/cbc:PayableAmount>/,
    )?.[1]
    expect(payable).toBe((961).toFixed(2))
  })

  it("TaxSubtotal bases sum to subtotal and amounts sum to vatTotal", () => {
    const bases = matchAll(
      xml,
      /<cbc:TaxableAmount currencyID="EUR">([^<]+)<\/cbc:TaxableAmount>/g,
    ).map(Number)
    const vats = matchAll(
      xml,
      /<cac:TaxSubtotal>[\s\S]*?<cbc:TaxAmount currencyID="EUR">([^<]+)<\/cbc:TaxAmount>/g,
    ).map(Number)
    const sumBase = bases.reduce((a, b) => a + b, 0)
    const sumVat = vats.reduce((a, b) => a + b, 0)
    expect(sumBase).toBeCloseTo(800, 2)
    expect(sumVat).toBeCloseTo(161, 2)
  })

  it("maps SK units to UN/ECE codes (hod → HUR, ks → C62)", () => {
    expect(xml).toContain('unitCode="HUR"')
    expect(xml).toContain('unitCode="C62"')
  })

  it("emits PaymentMeans with IBAN and credit-transfer code", () => {
    expect(xml).toContain("<cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>")
    expect(xml).toContain("<cbc:PaymentID>2026001</cbc:PaymentID>")
    expect(xml).toContain("<cbc:ID>SK3112000000198742637541</cbc:ID>")
  })
})

describe("serializeUbl — reverse charge domestic", () => {
  it("produces category AE with 0 VAT", () => {
    const items: DocumentItemRow[] = [
      makeItem({
        position: 0,
        description: "Stavebné práce",
        quantity: 1,
        unit: "ks",
        unit_price: 1000,
        vat_rate: 23, // input rate ignored for AE
        line_base: 1000,
        line_vat: 0,
        line_total: 1000,
      }),
    ]
    const document = makeDocument({
      vat_mode: "reverse_charge_domestic" as VatMode,
      subtotal: 1000,
      vat_total: 0,
      total: 1000,
    })
    const { model, xml } = buildUblInvoice({
      document,
      items,
      organization: makeOrganization(),
      contact: makeContact(),
      bankAccount: makeBankAccount(),
    })

    expect(model.taxSubtotals).toHaveLength(1)
    expect(model.taxSubtotals[0]?.category).toBe("AE")
    expect(model.taxSubtotals[0]?.rate).toBe(0)
    expect(model.taxSubtotals[0]?.vat).toBe(0)

    expect(xml).toContain("<cbc:ID>AE</cbc:ID>")
    expect(xml).toContain(
      '<cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>',
    )
    // Tax category percent is 0 for AE.
    expect(xml).toContain("<cbc:Percent>0.00</cbc:Percent>")
  })
})

describe("serializeUbl — XML escaping", () => {
  it("escapes special characters in a description", () => {
    const items: DocumentItemRow[] = [
      makeItem({
        position: 0,
        description: 'Tovar & "spol" <x>',
        line_base: 100,
        line_vat: 23,
        line_total: 123,
      }),
    ]
    const document = makeDocument({
      subtotal: 100,
      vat_total: 23,
      total: 123,
    })
    const { xml } = buildUblInvoice({
      document,
      items,
      organization: makeOrganization(),
      contact: makeContact(),
      bankAccount: makeBankAccount(),
    })
    expect(xml).toContain("Tovar &amp; &quot;spol&quot; &lt;x&gt;")
    expect(xml).not.toContain('Tovar & "spol"')
  })
})

describe("toUblModel — Peppol id derivation", () => {
  it("derives the seller peppolId from DIČ when peppol_id is empty", () => {
    const model = toUblModel({
      document: makeDocument({ subtotal: 0, vat_total: 0, total: 0 }),
      items: [],
      organization: makeOrganization({ peppol_id: null }),
      contact: makeContact({ peppol_id: null }),
      bankAccount: null,
    })
    expect(model.seller.peppolId).toBe("0245:2020317068")
    expect(model.buyer.peppolId).toBe("0245:2021234567")
  })

  it("buildUblInvoice equals serializeUbl(toUblModel(input))", () => {
    const input = payerFixture()
    const built = buildUblInvoice(input)
    expect(built.xml).toBe(serializeUbl(toUblModel(input)))
  })
})
