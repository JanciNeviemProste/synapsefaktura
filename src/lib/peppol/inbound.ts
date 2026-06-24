/**
 * Inbound EN 16931 / Peppol BIS 3.0 (UBL 2.1 `<Invoice>`) parser.
 *
 * Reconstructs our normalized {@link UblInvoiceModel} from inbound XML — the
 * §5.5/§8 inbound path that feeds auto-creation of an expense. This is the
 * inverse of `buildUblInvoice` in `./ubl.ts` and matches its element paths.
 *
 * Pure: no I/O, no DOM (runs in Node / Next server). Instead of pulling in an
 * XML library we ship a minimal, tolerant string/regex reader — sufficient for
 * the well-formed UBL we and other senders produce. Helpers match on the local
 * tag name regardless of namespace prefix so a slightly different sender (e.g.
 * `n1:ID` instead of `cbc:ID`) still parses.
 */

import type {
  PeppolParty,
  UblInvoiceModel,
  UblLine,
  UblTaxSubtotal,
  VatMode,
} from "@/lib/peppol/types"

// ── XML primitives ────────────────────────────────────────────────────────────

/** Unescape the five predefined XML entities (+ numeric refs). */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    // `&amp;` must be last so we don't double-decode (e.g. `&amp;lt;`).
    .replace(/&amp;/g, "&")
}

/** Local-name matcher: `ID` matches `<cbc:ID>` and `<ID>` alike. */
function tagPattern(local: string): string {
  return `(?:[A-Za-z_][\\w.-]*:)?${local}`
}

/**
 * Return the inner XML of the *first* `<local …>…</local>` element found in
 * `scope`, or null. Skips self-closing/empty elements (returns "" for those).
 */
function firstElement(scope: string, local: string): string | null {
  const open = new RegExp(`<${tagPattern(local)}(\\s[^>]*?)?(/)?>`, "i")
  const m = open.exec(scope)
  if (!m) return null
  if (m[2] === "/") return "" // self-closing
  const start = m.index + m[0].length
  const close = new RegExp(`</${tagPattern(local)}\\s*>`, "i")
  close.lastIndex = start
  const c = close.exec(scope.slice(start))
  if (!c) return null
  return scope.slice(start, start + c.index)
}

/** Trimmed, unescaped text content of the first matching element, or null. */
function text(scope: string, local: string): string | null {
  const inner = firstElement(scope, local)
  if (inner == null) return null
  return unescapeXml(inner.trim())
}

/** Read an attribute off the *opening tag* of the first matching element. */
function attr(scope: string, local: string, attribute: string): string | null {
  const open = new RegExp(`<${tagPattern(local)}(\\s[^>]*?)?(/)?>`, "i")
  const m = open.exec(scope)
  if (!m || !m[1]) return null
  const a = new RegExp(`\\b${attribute}\\s*=\\s*"([^"]*)"`, "i").exec(m[1])
  return a ? unescapeXml(a[1]) : null
}

/** Inner XML of every top-level `<local>…</local>` block within `scope`. */
function allElements(scope: string, local: string): string[] {
  const out: string[] = []
  const open = new RegExp(`<${tagPattern(local)}(\\s[^>]*?)?(/)?>`, "ig")
  const close = new RegExp(`</${tagPattern(local)}\\s*>`, "i")
  let m: RegExpExecArray | null
  while ((m = open.exec(scope)) !== null) {
    if (m[2] === "/") {
      out.push("")
      continue
    }
    const start = m.index + m[0].length
    const rest = scope.slice(start)
    const c = close.exec(rest)
    if (!c) break
    out.push(rest.slice(0, c.index))
    open.lastIndex = start + c.index
  }
  return out
}

function num(scope: string, local: string): number {
  const t = text(scope, local)
  if (t == null || t === "") return 0
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

// ── Mapping tables (reverse of ubl.ts) ────────────────────────────────────────

/** UN/ECE Rec 20 unit code → our SK unit. */
const UNIT_BY_CODE: Record<string, string> = {
  C62: "ks",
  HUR: "hod",
  KGM: "kg",
  MTR: "m",
  DAY: "deň",
  MTK: "m2",
  MTQ: "m3",
  LTR: "l",
  TNE: "t",
  KMT: "km",
}

function unitFromCode(code: string | null): string {
  if (!code) return "ks"
  return UNIT_BY_CODE[code.toUpperCase()] ?? "ks"
}

/** UBL tax category code → our VatMode. */
const VAT_MODE_BY_CATEGORY: Record<string, VatMode> = {
  S: "payer",
  AE: "reverse_charge_domestic",
  K: "intra_eu_b2b",
  G: "export",
  E: "exempt",
  O: "non_payer",
}

function vatModeFromCategory(category: string | null): VatMode {
  if (!category) return "payer"
  return VAT_MODE_BY_CATEGORY[category.toUpperCase()] ?? "payer"
}

// ── Party ─────────────────────────────────────────────────────────────────────

function parseParty(partyXml: string): PeppolParty {
  const endpointValue = text(partyXml, "EndpointID")
  const scheme = attr(partyXml, "EndpointID", "schemeID")
  const peppolId =
    endpointValue && scheme
      ? `${scheme}:${endpointValue}`
      : endpointValue
        ? endpointValue
        : null

  const name =
    text(firstElement(partyXml, "PartyName") ?? partyXml, "Name") ??
    text(partyXml, "RegistrationName") ??
    ""

  const address = firstElement(partyXml, "PostalAddress") ?? partyXml
  const country =
    text(firstElement(address, "Country") ?? address, "IdentificationCode") ??
    text(firstElement(partyXml, "Country") ?? partyXml, "IdentificationCode") ??
    "SK"

  const taxScheme = firstElement(partyXml, "PartyTaxScheme") ?? ""
  const legalEntity = firstElement(partyXml, "PartyLegalEntity") ?? ""

  return {
    name,
    peppolId,
    vatId: text(taxScheme, "CompanyID"),
    companyId: text(legalEntity, "CompanyID"),
    taxId: null,
    street: text(address, "StreetName"),
    city: text(address, "CityName"),
    postalCode: text(address, "PostalZone"),
    country,
  }
}

// ── Lines & tax ───────────────────────────────────────────────────────────────

function parseLine(lineXml: string, index: number): UblLine {
  const idText = text(lineXml, "ID")
  const idNum = idText != null ? Number.parseInt(idText, 10) : NaN
  const position = Number.isFinite(idNum) ? idNum - 1 : index

  const item = firstElement(lineXml, "Item") ?? ""
  const classified = firstElement(item, "ClassifiedTaxCategory") ?? ""
  const price = firstElement(lineXml, "Price") ?? ""

  return {
    position,
    description: text(item, "Name") ?? "",
    quantity: num(lineXml, "InvoicedQuantity"),
    unit: unitFromCode(attr(lineXml, "InvoicedQuantity", "unitCode")),
    unitPrice: num(price, "PriceAmount"),
    vatRate: num(classified, "Percent"),
    lineNet: num(lineXml, "LineExtensionAmount"),
    taxCategory: text(classified, "ID") ?? "S",
  }
}

function parseTaxSubtotal(stXml: string): UblTaxSubtotal {
  const category = firstElement(stXml, "TaxCategory") ?? ""
  return {
    base: num(stXml, "TaxableAmount"),
    vat: num(stXml, "TaxAmount"),
    rate: num(category, "Percent"),
    category: text(category, "ID") ?? "S",
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function parseUblInvoice(xml: string): UblInvoiceModel {
  if (!/<(?:[A-Za-z_][\w.-]*:)?Invoice[\s>]/i.test(xml)) {
    throw new Error("Neplatný UBL dokument: chýba koreňový element <Invoice>.")
  }

  const number = text(xml, "ID")
  if (!number) {
    throw new Error("Neplatná faktúra: chýba číslo faktúry (cbc:ID).")
  }

  const issueDate = text(xml, "IssueDate") ?? ""
  const dueDate = text(xml, "DueDate")
  const supplyDate =
    text(xml, "TaxPointDate") ??
    (() => {
      const period = firstElement(xml, "InvoicePeriod") ?? ""
      return text(period, "EndDate")
    })()
  const currency = text(xml, "DocumentCurrencyCode") ?? "EUR"

  // Parties — supplier first, then customer (top-level order in our output).
  const supplierWrap = firstElement(xml, "AccountingSupplierParty") ?? ""
  const customerWrap = firstElement(xml, "AccountingCustomerParty") ?? ""
  const seller = parseParty(firstElement(supplierWrap, "Party") ?? supplierWrap)
  const buyer = parseParty(firstElement(customerWrap, "Party") ?? customerWrap)

  // Payment means.
  const paymentMeans = firstElement(xml, "PaymentMeans") ?? ""
  const payee = firstElement(paymentMeans, "PayeeFinancialAccount") ?? ""
  const iban = text(payee, "ID")
  const bic = text(firstElement(payee, "FinancialInstitutionBranch") ?? payee, "ID")
  const paymentReference = text(paymentMeans, "PaymentID")

  // VAT breakdown — document-level TaxTotal (the one carrying TaxSubtotals).
  const taxTotals = allElements(xml, "TaxTotal")
  const docTaxTotal =
    taxTotals.find((t) => /TaxSubtotal/i.test(t)) ?? taxTotals[0] ?? ""
  const vatTotal = num(docTaxTotal, "TaxAmount")
  const taxSubtotals = allElements(docTaxTotal, "TaxSubtotal").map(parseTaxSubtotal)

  // Monetary totals.
  const monetary = firstElement(xml, "LegalMonetaryTotal") ?? ""
  const lineExtension = num(monetary, "LineExtensionAmount")
  const taxExclusive = num(monetary, "TaxExclusiveAmount")
  const subtotal = lineExtension || taxExclusive
  const taxInclusive = num(monetary, "TaxInclusiveAmount")
  const payable = num(monetary, "PayableAmount")
  const total = payable || taxInclusive

  // Lines.
  const lines = allElements(xml, "InvoiceLine").map(parseLine)

  // Dominant line tax category → vatMode (most net amount wins; tie → first).
  const vatMode = deriveVatMode(lines)

  return {
    number,
    issueDate,
    dueDate,
    supplyDate,
    currency,
    vatMode,
    note: text(xml, "Note"),
    seller,
    buyer,
    iban,
    bic,
    paymentReference,
    lines,
    taxSubtotals,
    subtotal,
    vatTotal,
    total,
  }
}

function deriveVatMode(lines: UblLine[]): VatMode {
  if (lines.length === 0) return "payer"
  const weight = new Map<string, number>()
  for (const l of lines) {
    const cat = (l.taxCategory || "S").toUpperCase()
    weight.set(cat, (weight.get(cat) ?? 0) + Math.abs(l.lineNet))
  }
  let bestCat = lines[0].taxCategory
  let bestWeight = -1
  for (const [cat, w] of weight) {
    if (w > bestWeight) {
      bestWeight = w
      bestCat = cat
    }
  }
  return vatModeFromCategory(bestCat)
}
