import { describe, expect, it } from "vitest"

import type { Database } from "@/lib/supabase/database.types"
import { parseUblInvoice } from "@/lib/peppol/inbound"

/**
 * A representative EN 16931 / Peppol BIS 3.0 UBL 2.1 invoice, hand-authored to
 * mirror the element paths our generator (`./ubl.ts`) emits. Kept inline so the
 * inbound parser tests are self-sufficient even before `ubl.ts` lands.
 *
 * `Riešenie &amp; "konzultácie"` exercises entity unescaping in a description.
 */
const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ID>2026001</cbc:ID>
  <cbc:IssueDate>2026-06-24</cbc:IssueDate>
  <cbc:DueDate>2026-07-08</cbc:DueDate>
  <cbc:TaxPointDate>2026-06-20</cbc:TaxPointDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">2020317068</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Hlavná 1</cbc:StreetName>
        <cbc:CityName>Bratislava</cbc:CityName>
        <cbc:PostalZone>81101</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2020317068</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Predajca s.r.o.</cbc:RegistrationName>
        <cbc:CompanyID>12345678</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:PartyName><cbc:Name>Predajca s.r.o.</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">2120000000</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Vedľajšia 2</cbc:StreetName>
        <cbc:CityName>Košice</cbc:CityName>
        <cbc:PostalZone>04001</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2120000000</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Odberateľ a.s.</cbc:RegistrationName>
        <cbc:CompanyID>87654321</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:PartyName><cbc:Name>Odberateľ a.s.</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>2026001</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>SK8975000000000012345671</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">200.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">200.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">200.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">246.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">246.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">150.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Riešenie &amp; "konzultácie"</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">15.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:ID>2</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">5</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Licencia</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">10.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`

describe("parseUblInvoice — inline UBL fixture", () => {
  const model = parseUblInvoice(FIXTURE_XML)

  it("maps header fields", () => {
    expect(model.number).toBe("2026001")
    expect(model.issueDate).toBe("2026-06-24")
    expect(model.dueDate).toBe("2026-07-08")
    expect(model.supplyDate).toBe("2026-06-20")
    expect(model.currency).toBe("EUR")
  })

  it("maps both parties", () => {
    expect(model.seller.name).toBe("Predajca s.r.o.")
    expect(model.seller.vatId).toBe("SK2020317068")
    expect(model.seller.companyId).toBe("12345678")
    expect(model.seller.peppolId).toBe("0245:2020317068")
    expect(model.seller.country).toBe("SK")
    expect(model.seller.city).toBe("Bratislava")

    expect(model.buyer.name).toBe("Odberateľ a.s.")
    expect(model.buyer.peppolId).toBe("0245:2120000000")
    expect(model.buyer.vatId).toBe("SK2120000000")
  })

  it("maps payment means", () => {
    expect(model.iban).toBe("SK8975000000000012345671")
    expect(model.paymentReference).toBe("2026001")
  })

  it("maps monetary totals and VAT breakdown", () => {
    expect(model.subtotal).toBe(200)
    expect(model.vatTotal).toBe(46)
    expect(model.total).toBe(246)
    expect(model.taxSubtotals).toHaveLength(1)
    expect(model.taxSubtotals[0]).toMatchObject({ base: 200, vat: 46, rate: 23 })
  })

  it("maps lines (incl. unit reverse map + entity unescape)", () => {
    expect(model.lines).toHaveLength(2)
    const first = model.lines[0]
    expect(first.position).toBe(0)
    expect(first.description).toBe('Riešenie & "konzultácie"')
    expect(first.quantity).toBe(10)
    expect(first.unit).toBe("hod") // HUR → hod
    expect(first.unitPrice).toBe(15)
    expect(first.lineNet).toBe(150)
    expect(model.lines[1].unit).toBe("ks") // C62 → ks
  })

  it("derives vatMode from dominant line tax category", () => {
    expect(model.vatMode).toBe("payer") // S
  })

  it("throws Slovak error when root <Invoice> is missing", () => {
    expect(() => parseUblInvoice("<NotAnInvoice/>")).toThrow(/Invoice/)
  })

  it("throws Slovak error when invoice number is missing", () => {
    const noId = FIXTURE_XML.replace("<cbc:ID>2026001</cbc:ID>", "<cbc:ID></cbc:ID>")
    expect(() => parseUblInvoice(noId)).toThrow(/číslo faktúry/)
  })
})

describe("parseUblInvoice — reverse charge (AE)", () => {
  const AE_XML = `<?xml version="1.0"?>
<Invoice xmlns:cac="urn:cac" xmlns:cbc="urn:cbc">
  <cbc:ID>RC-1</cbc:ID>
  <cbc:IssueDate>2026-06-24</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>Dodávateľ</cbc:Name></cac:PartyName>
    <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyName><cbc:Name>Odberateľ</cbc:Name></cac:PartyName>
    <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>AE</cbc:ID><cbc:Percent>0</cbc:Percent></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cbc:PayableAmount currencyID="EUR">100.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Služba s prenosom daňovej povinnosti</cbc:Name>
      <cac:ClassifiedTaxCategory><cbc:ID>AE</cbc:ID><cbc:Percent>0</cbc:Percent></cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`

  it("parses to reverse_charge_domestic with zero VAT", () => {
    const model = parseUblInvoice(AE_XML)
    expect(model.vatMode).toBe("reverse_charge_domestic")
    expect(model.vatTotal).toBe(0)
    expect(model.lines[0].taxCategory).toBe("AE")
  })
})

// ── Round-trip against the real generator ─────────────────────────────────────
// parseUblInvoice must be the inverse of buildUblInvoice: generate → parse →
// the model must match the source on every field we care about.
describe("parseUblInvoice — round trip against buildUblInvoice", () => {
  type Tables = Database["public"]["Tables"]
  type DocumentRow = Tables["documents"]["Row"]
  type DocumentItemRow = Tables["document_items"]["Row"]
  type OrganizationRow = Tables["organizations"]["Row"]
  type ContactRow = Tables["contacts"]["Row"]
  type BankAccountRow = Tables["bank_accounts"]["Row"]

  const org = {
    id: "org-1",
    name: "Dodávateľ s.r.o.",
    ico: "35757442",
    dic: "2020317068",
    ic_dph: "SK2020317068",
    street: "Hlavná 1",
    city: "Bratislava",
    postal_code: "81101",
    country: "SK",
    peppol_id: "0245:2020317068",
  } as unknown as OrganizationRow

  const contact = {
    id: "contact-1",
    organization_id: "org-1",
    name: 'Odberateľ & "spol" a.s.',
    ico: "12345678",
    dic: "2021234567",
    ic_dph: "SK2021234567",
    street: "Mlynská 5",
    city: "Košice",
    postal_code: "04001",
    country: "SK",
    peppol_id: "0245:2021234567",
    type: "customer",
  } as unknown as ContactRow

  const bank = {
    id: "bank-1",
    organization_id: "org-1",
    iban: "SK3112000000198742637541",
    swift: "TATRSKBX",
    is_default: true,
  } as unknown as BankAccountRow

  const document = {
    id: "doc-1",
    organization_id: "org-1",
    contact_id: "contact-1",
    number: "2026001",
    type: "invoice",
    status: "issued",
    currency: "EUR",
    issue_date: "2026-06-25",
    supply_date: "2026-06-25",
    due_date: "2026-07-09",
    vat_mode: "payer",
    subtotal: 700,
    vat_total: 115,
    total: 815,
  } as unknown as DocumentRow

  const items = [
    {
      id: "i1",
      document_id: "doc-1",
      position: 0,
      description: "Konzultácie",
      quantity: 10,
      unit: "hod",
      unit_price: 50,
      vat_rate: 23,
      discount_pct: 0,
      line_base: 500,
      line_vat: 115,
      line_total: 615,
    },
    {
      id: "i2",
      document_id: "doc-1",
      position: 1,
      description: "Zľavnená služba",
      quantity: 1,
      unit: "ks",
      unit_price: 200,
      vat_rate: 0,
      discount_pct: 0,
      line_base: 200,
      line_vat: 0,
      line_total: 200,
    },
  ] as unknown as DocumentItemRow[]

  it("round-trips a generated payer invoice", async () => {
    const { buildUblInvoice } = await import("@/lib/peppol/ubl")
    const { model: source, xml } = buildUblInvoice({
      document,
      items,
      organization: org,
      contact,
      bankAccount: bank,
    })
    const model = parseUblInvoice(xml)

    expect(model.number).toBe("2026001")
    expect(model.issueDate).toBe("2026-06-25")
    expect(model.currency).toBe("EUR")
    expect(model.seller.name).toBe("Dodávateľ s.r.o.")
    expect(model.seller.vatId).toBe("SK2020317068")
    expect(model.buyer.name).toBe('Odberateľ & "spol" a.s.')
    expect(model.buyer.peppolId).toBe("0245:2021234567")
    expect(model.iban).toBe("SK3112000000198742637541")
    expect(model.paymentReference).toBe("2026001")
    expect(model.subtotal).toBeCloseTo(source.subtotal, 2)
    expect(model.vatTotal).toBeCloseTo(source.vatTotal, 2)
    expect(model.total).toBeCloseTo(source.total, 2)
    expect(model.lines).toHaveLength(2)
    expect(model.lines[0].description).toBe("Konzultácie")
    expect(model.lines[0].quantity).toBeCloseTo(10, 2)
    expect(model.lines[0].unitPrice).toBeCloseTo(50, 2)
    expect(model.lines[0].lineNet).toBeCloseTo(500, 2)
    expect(model.vatMode).toBe("payer")

    // tax subtotals must match the source grouping (23 % and 0 %)
    const srcByRate = Object.fromEntries(
      source.taxSubtotals.map((s) => [s.rate, s]),
    )
    for (const sub of model.taxSubtotals) {
      const src = srcByRate[sub.rate]
      expect(src).toBeDefined()
      expect(sub.base).toBeCloseTo(src.base, 2)
      expect(sub.vat).toBeCloseTo(src.vat, 2)
    }
  })
})
