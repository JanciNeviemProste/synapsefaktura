/**
 * EN 16931 / Peppol BIS Billing 3.0 (UBL 2.1) `<Invoice>` generovanie.
 *
 * Tento modul iba SERIALIZUJE už vypočítané a zaokrúhlené sumy z DB (§5.5 / §8
 * brief-u). Nič tu neprepočítavame — `line_base` / `line_vat` / `line_total`
 * a `subtotal` / `vat_total` / `total` sú autoritatívne hodnoty.
 */

import type { Database } from "@/lib/supabase/database.types"
import { parsePeppolId, slovakPeppolId } from "@/lib/peppol/id"
import type {
  PeppolParty,
  UblInvoiceModel,
  UblLine,
  UblTaxSubtotal,
  VatMode,
} from "@/lib/peppol/types"

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type DocumentItemRow = Database["public"]["Tables"]["document_items"]["Row"]
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"]
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
type BankAccountRow = Database["public"]["Tables"]["bank_accounts"]["Row"]

// ── UBL konštanty ─────────────────────────────────────────────────────────────

const CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
const PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
const INVOICE_TYPE_CODE = "380"
const PAYMENT_MEANS_CODE_CREDIT_TRANSFER = "30"

/**
 * VAT mode → UBL tax category code (SK).
 * // TODO: verify against official Finančná správa source — confirm category
 * // codes (najmä `O`/`K`/`G` voľba) proti SK BIS transpozícii pred produkciou.
 */
const VAT_MODE_CATEGORY: Record<VatMode, string> = {
  payer: "S", // standard rated
  non_payer: "O", // services outside scope of VAT (neplatiteľ)
  reverse_charge_domestic: "AE", // VAT reverse charge
  intra_eu_b2b: "K", // intra-Community supply
  export: "G", // export outside the EU
  exempt: "E", // exempt from VAT
  oss: "S",
}

/** Kategórie, kde je sadzba vždy 0 %. */
const ZERO_RATE_CATEGORIES = new Set(["AE", "K", "G", "E", "O"])

/**
 * SK unit → UN/ECE Rec 20 kód. Default `C62`.
 * // TODO: verify against UN/ECE Rec 20 + SK BIS unit code list.
 */
const UNIT_CODE_MAP: Record<string, string> = {
  ks: "C62",
  hod: "HUR",
  h: "HUR",
  deň: "DAY",
  den: "DAY",
  kg: "KGM",
  m: "MTR",
  m2: "MTK",
  m3: "MTQ",
  l: "LTR",
  km: "KMT",
}

function unitCode(unit: string | null | undefined): string {
  if (!unit) return "C62"
  return UNIT_CODE_MAP[unit.trim().toLowerCase()] ?? "C62"
}

function categoryFor(vatMode: VatMode): string {
  return VAT_MODE_CATEGORY[vatMode] ?? "S"
}

/** Pre nulové režimy je percento vždy 0, inak skutočná sadzba položky. */
function effectiveRate(category: string, vatRate: number): number {
  return ZERO_RATE_CATEGORIES.has(category) ? 0 : vatRate
}

// ── Model builder ─────────────────────────────────────────────────────────────

function partyPeppolId(
  peppolId: string | null | undefined,
  dic: string | null | undefined,
): string | null {
  if (peppolId && peppolId.trim() !== "") return peppolId
  return slovakPeppolId(dic)
}

function organizationParty(org: OrganizationRow): PeppolParty {
  return {
    name: org.name,
    peppolId: partyPeppolId(org.peppol_id, org.dic),
    vatId: org.ic_dph,
    companyId: org.ico,
    taxId: org.dic,
    street: org.street,
    city: org.city,
    postalCode: org.postal_code,
    country: org.country,
  }
}

function contactParty(contact: ContactRow): PeppolParty {
  return {
    name: contact.name,
    peppolId: partyPeppolId(contact.peppol_id, contact.dic),
    vatId: contact.ic_dph,
    companyId: contact.ico,
    taxId: contact.dic,
    street: contact.street,
    city: contact.city,
    postalCode: contact.postal_code,
    country: contact.country,
  }
}

export function toUblModel(input: {
  document: DocumentRow
  items: DocumentItemRow[]
  organization: OrganizationRow
  contact: ContactRow | null
  bankAccount: BankAccountRow | null
}): UblInvoiceModel {
  const { document, items, organization, contact, bankAccount } = input

  const category = categoryFor(document.vat_mode)

  const lines: UblLine[] = items.map((item) => ({
    position: item.position,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unit_price,
    vatRate: effectiveRate(category, item.vat_rate),
    lineNet: item.line_base,
    taxCategory: category,
  }))

  // VAT breakdown — zoskup položky podľa efektívnej sadzby. line_base / line_vat
  // sú autoritatívne, len ich sčítavame.
  const groups = new Map<number, UblTaxSubtotal>()
  for (const item of items) {
    const rate = effectiveRate(category, item.vat_rate)
    const existing = groups.get(rate)
    if (existing) {
      existing.base += item.line_base
      existing.vat += item.line_vat
    } else {
      groups.set(rate, {
        rate,
        base: item.line_base,
        vat: item.line_vat,
        category,
      })
    }
  }
  const taxSubtotals = Array.from(groups.values()).sort((a, b) => b.rate - a.rate)

  const buyer: PeppolParty = contact
    ? contactParty(contact)
    : { name: "", country: organization.country }

  return {
    number: document.number ?? "",
    issueDate: document.issue_date ?? "",
    dueDate: document.due_date,
    supplyDate: document.supply_date,
    currency: document.currency,
    vatMode: document.vat_mode,
    note: document.notes ?? document.legal_notes ?? null,
    seller: organizationParty(organization),
    buyer,
    iban: bankAccount?.iban ?? null,
    bic: bankAccount?.swift ?? null,
    paymentReference: document.number ?? null,
    lines,
    taxSubtotals,
    subtotal: document.subtotal,
    vatTotal: document.vat_total,
    total: document.total,
  }
}

// ── XML builder (hand-rolled, žiadna npm závislosť) ──────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

type Attrs = Record<string, string | number | null | undefined>

function attrString(attrs?: Attrs): string {
  if (!attrs) return ""
  let out = ""
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw === null || raw === undefined) continue
    out += ` ${key}="${escapeXml(String(raw))}"`
  }
  return out
}

/** Leaf element s textom. */
function el(name: string, value: string | number, attrs?: Attrs): string {
  return `<${name}${attrString(attrs)}>${escapeXml(String(value))}</${name}>`
}

/** Wrapper element okolo už serializovaných detí. */
function wrap(name: string, children: string, attrs?: Attrs): string {
  return `<${name}${attrString(attrs)}>${children}</${name}>`
}

function money(amount: number): string {
  return amount.toFixed(2)
}

/** EndpointID + schemeID (bez "scheme:" prefixu — schemeID nesie schému). */
function endpointId(peppolId: string | null | undefined): string {
  const parsed = parsePeppolId(peppolId)
  if (!parsed) return ""
  return el("cbc:EndpointID", parsed.value, { schemeID: parsed.scheme })
}

function postalAddress(party: PeppolParty): string {
  let body = ""
  if (party.street) body += el("cbc:StreetName", party.street)
  if (party.city) body += el("cbc:CityName", party.city)
  if (party.postalCode) body += el("cbc:PostalZone", party.postalCode)
  body += wrap(
    "cac:Country",
    el("cbc:IdentificationCode", party.country),
  )
  return wrap("cac:PostalAddress", body)
}

function partyXml(party: PeppolParty): string {
  let body = ""
  body += endpointId(party.peppolId)
  body += wrap("cac:PartyName", el("cbc:Name", party.name))
  body += postalAddress(party)
  if (party.vatId) {
    body += wrap(
      "cac:PartyTaxScheme",
      el("cbc:CompanyID", party.vatId) +
        wrap("cac:TaxScheme", el("cbc:ID", "VAT")),
    )
  }
  let legal = el("cbc:RegistrationName", party.name)
  if (party.companyId) legal += el("cbc:CompanyID", party.companyId)
  body += wrap("cac:PartyLegalEntity", legal)
  return wrap("cac:Party", body)
}

function taxCategoryXml(
  tag: "cac:TaxCategory" | "cac:ClassifiedTaxCategory",
  category: string,
  rate: number,
): string {
  return wrap(
    tag,
    el("cbc:ID", category) +
      el("cbc:Percent", rate.toFixed(2)) +
      wrap("cac:TaxScheme", el("cbc:ID", "VAT")),
  )
}

function taxTotalXml(model: UblInvoiceModel): string {
  const currency = model.currency
  let subtotals = ""
  for (const sub of model.taxSubtotals) {
    subtotals += wrap(
      "cac:TaxSubtotal",
      el("cbc:TaxableAmount", money(sub.base), { currencyID: currency }) +
        el("cbc:TaxAmount", money(sub.vat), { currencyID: currency }) +
        taxCategoryXml("cac:TaxCategory", sub.category, sub.rate),
    )
  }
  return wrap(
    "cac:TaxTotal",
    el("cbc:TaxAmount", money(model.vatTotal), { currencyID: currency }) +
      subtotals,
  )
}

function paymentMeansXml(model: UblInvoiceModel): string {
  if (!model.iban) return ""
  let body =
    el("cbc:PaymentMeansCode", PAYMENT_MEANS_CODE_CREDIT_TRANSFER) +
    el("cbc:PaymentID", model.paymentReference ?? model.number)
  let account = el("cbc:ID", model.iban)
  if (model.bic) {
    account += wrap(
      "cac:FinancialInstitutionBranch",
      el("cbc:ID", model.bic),
    )
  }
  body += wrap("cac:PayeeFinancialAccount", account)
  return wrap("cac:PaymentMeans", body)
}

function legalMonetaryTotalXml(model: UblInvoiceModel): string {
  const currency = model.currency
  return wrap(
    "cac:LegalMonetaryTotal",
    el("cbc:LineExtensionAmount", money(model.subtotal), {
      currencyID: currency,
    }) +
      el("cbc:TaxExclusiveAmount", money(model.subtotal), {
        currencyID: currency,
      }) +
      el("cbc:TaxInclusiveAmount", money(model.total), {
        currencyID: currency,
      }) +
      el("cbc:PayableAmount", money(model.total), { currencyID: currency }),
  )
}

function invoiceLineXml(line: UblLine, currency: string): string {
  let body =
    el("cbc:ID", line.position + 1) +
    el("cbc:InvoicedQuantity", line.quantity, {
      unitCode: unitCode(line.unit),
    }) +
    el("cbc:LineExtensionAmount", money(line.lineNet), {
      currencyID: currency,
    })
  body += wrap(
    "cac:Item",
    el("cbc:Name", line.description) +
      taxCategoryXml("cac:ClassifiedTaxCategory", line.taxCategory, line.vatRate),
  )
  body += wrap(
    "cac:Price",
    el("cbc:PriceAmount", money(line.unitPrice), { currencyID: currency }),
  )
  return wrap("cac:InvoiceLine", body)
}

export function serializeUbl(model: UblInvoiceModel): string {
  const currency = model.currency

  let body = ""
  body += el("cbc:CustomizationID", CUSTOMIZATION_ID)
  body += el("cbc:ProfileID", PROFILE_ID)
  body += el("cbc:ID", model.number)
  body += el("cbc:IssueDate", model.issueDate)
  if (model.dueDate) body += el("cbc:DueDate", model.dueDate)
  body += el("cbc:InvoiceTypeCode", INVOICE_TYPE_CODE)
  if (model.note) body += el("cbc:Note", model.note)
  // Tax point / DUZP. // TODO: verify which is required by SK (TaxPointDate vs
  // InvoicePeriod/EndDate). Emitujeme cbc:TaxPointDate keď je supply_date.
  if (model.supplyDate) body += el("cbc:TaxPointDate", model.supplyDate)
  body += el("cbc:DocumentCurrencyCode", currency)

  body += wrap(
    "cac:AccountingSupplierParty",
    partyXml(model.seller),
  )
  body += wrap(
    "cac:AccountingCustomerParty",
    partyXml(model.buyer),
  )

  body += paymentMeansXml(model)
  body += taxTotalXml(model)
  body += legalMonetaryTotalXml(model)

  for (const line of model.lines) {
    body += invoiceLineXml(line, currency)
  }

  const invoice = wrap("Invoice", body, {
    xmlns: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "xmlns:cac":
      "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents",
    "xmlns:cbc":
      "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents",
  })

  return `<?xml version="1.0" encoding="UTF-8"?>${invoice}`
}

export function buildUblInvoice(input: {
  document: DocumentRow
  items: DocumentItemRow[]
  organization: OrganizationRow
  contact: ContactRow | null
  bankAccount: BankAccountRow | null
}): { model: UblInvoiceModel; xml: string } {
  const model = toUblModel(input)
  return { model, xml: serializeUbl(model) }
}
