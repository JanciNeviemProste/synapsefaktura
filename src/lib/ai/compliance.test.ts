import { describe, expect, it } from "vitest"
import { checkCompliance, type ComplianceInput } from "@/lib/ai/compliance"
import type { Database } from "@/lib/supabase/database.types"

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type DocumentItemRow = Database["public"]["Tables"]["document_items"]["Row"]
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"]
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
type VatRateRow = Database["public"]["Tables"]["vat_rates"]["Row"]

// VAT rates as seeded: legacy 20/10 valid before 2025-01-01, active 23/19/5/0 from then.
const VAT_RATES: VatRateRow[] = [
  {
    code: "std_legacy",
    percent: 20,
    valid_from: "2011-01-01",
    valid_to: "2025-01-01",
    category_note: null,
  },
  {
    code: "red_legacy",
    percent: 10,
    valid_from: "2011-01-01",
    valid_to: "2025-01-01",
    category_note: null,
  },
  {
    code: "std",
    percent: 23,
    valid_from: "2025-01-01",
    valid_to: null,
    category_note: null,
  },
  {
    code: "red1",
    percent: 19,
    valid_from: "2025-01-01",
    valid_to: null,
    category_note: null,
  },
  {
    code: "red2",
    percent: 5,
    valid_from: "2025-01-01",
    valid_to: null,
    category_note: null,
  },
  {
    code: "zero",
    percent: 0,
    valid_from: "2025-01-01",
    valid_to: null,
    category_note: null,
  },
]

function makeOrg(over: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    city: null,
    country: "SK",
    created_at: "2025-01-01T00:00:00Z",
    default_currency: "EUR",
    default_due_days: 14,
    default_language: "sk",
    dic: "2020202020",
    digital_postman_provider: null,
    einvoice_enabled: false,
    ic_dph: "SK2020202020",
    ico: "11111111",
    id: "org-1",
    is_vat_payer: true,
    legal_form: null,
    logo_url: null,
    name: "Test s.r.o.",
    peppol_id: null,
    postal_code: null,
    signature_url: null,
    stamp_url: null,
    street: null,
    updated_at: "2025-01-01T00:00:00Z",
    vat_mode_default: "payer",
    plan: "free",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    current_period_end: null,
    ...over,
  }
}

function makeContact(over: Partial<ContactRow> = {}): ContactRow {
  return {
    city: null,
    country: "SK",
    created_at: "2025-01-01T00:00:00Z",
    default_due_days: null,
    dic: "3030303030",
    email: null,
    ic_dph: "SK3030303030",
    ico: "22222222",
    id: "contact-1",
    name: "Odberateľ a.s.",
    notes: null,
    organization_id: "org-1",
    payment_behavior_score: null,
    peppol_id: null,
    phone: null,
    postal_code: null,
    street: null,
    type: "customer",
    updated_at: "2025-01-01T00:00:00Z",
    ...over,
  }
}

function makeDoc(over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    contact_id: "contact-1",
    created_at: "2026-03-01T00:00:00Z",
    created_by: null,
    currency: "EUR",
    due_date: "2026-03-15",
    exchange_rate: 1,
    footer_notes: null,
    id: "doc-1",
    issue_date: "2026-03-01",
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
    status: "draft",
    subtotal: 100,
    supply_date: "2026-03-01",
    total: 123,
    type: "invoice",
    updated_at: "2026-03-01T00:00:00Z",
    vat_mode: "payer",
    vat_total: 23,
    ...over,
  }
}

function makeItem(over: Partial<DocumentItemRow> = {}): DocumentItemRow {
  return {
    // Uctovne clenenie (export do uctovnictva) — na vypocty tu vplyv nema.
    account_code: null,
    activity_code: null,
    cost_center: null,
    project_code: null,
    created_at: "2026-03-01T00:00:00Z",
    description: "Konzultačné služby",
    discount_pct: 0,
    document_id: "doc-1",
    id: "item-1",
    line_base: 100,
    line_total: 123,
    line_vat: 23,
    position: 1,
    product_id: null,
    quantity: 1,
    unit: "ks",
    unit_price: 100,
    vat_rate: 23,
    ...over,
  }
}

function baseInput(over: Partial<ComplianceInput> = {}): ComplianceInput {
  return {
    doc: makeDoc(),
    items: [makeItem()],
    org: makeOrg(),
    contact: makeContact(),
    vatRates: VAT_RATES,
    iban: "SK8975000000000012345671",
    ...over,
  }
}

describe("checkCompliance", () => {
  it("clean payer invoice → high score, no errors", () => {
    const { score, issues } = checkCompliance(baseInput())
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0)
    expect(score).toBeGreaterThanOrEqual(90)
  })

  it("legacy 20% rate on a 2026 issue date → error", () => {
    const { issues } = checkCompliance(
      baseInput({ items: [makeItem({ vat_rate: 20 })] }),
    )
    const rateError = issues.find(
      (i) => i.severity === "error" && i.message.includes("20 %"),
    )
    expect(rateError).toBeDefined()
  })

  it("active 23% on a 2026 issue date → no rate error", () => {
    const { issues } = checkCompliance(baseInput())
    expect(issues.some((i) => i.message.includes("sadzba DPH"))).toBe(false)
  })

  it("reverse_charge without buyer IČ DPH → error", () => {
    const { issues } = checkCompliance(
      baseInput({
        doc: makeDoc({
          vat_mode: "reverse_charge_domestic",
          legal_notes:
            "Prenesenie daňovej povinnosti podľa §69 zákona č. 222/2004 Z. z.",
        }),
        contact: makeContact({ ic_dph: null }),
      }),
    )
    const err = issues.find(
      (i) => i.severity === "error" && i.message.includes("IČ DPH odberateľa"),
    )
    expect(err).toBeDefined()
  })

  it("non_payer missing required note → warning", () => {
    const { issues } = checkCompliance(
      baseInput({
        doc: makeDoc({ vat_mode: "non_payer", legal_notes: null }),
        org: makeOrg({ is_vat_payer: false, ic_dph: null }),
      }),
    )
    const noteWarn = issues.find(
      (i) =>
        i.severity === "warning" && i.message.includes("Nie som platiteľ DPH."),
    )
    expect(noteWarn).toBeDefined()
    // Non-payer note absence must NOT be promoted to an error.
    expect(
      issues.some(
        (i) =>
          i.severity === "error" && i.message.includes("Nie som platiteľ DPH."),
      ),
    ).toBe(false)
  })

  it("non_payer with required note present → no note issue", () => {
    const { issues } = checkCompliance(
      baseInput({
        doc: makeDoc({
          vat_mode: "non_payer",
          legal_notes: "Nie som platiteľ DPH.",
        }),
        org: makeOrg({ is_vat_payer: false, ic_dph: null }),
      }),
    )
    expect(
      issues.some((i) => i.message.includes("Nie som platiteľ DPH.")),
    ).toBe(false)
  })
})
