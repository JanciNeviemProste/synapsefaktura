import type { Database } from "@/lib/supabase/database.types"

/**
 * Shared Peppol / EN 16931 types for Phase 4 (e-invoice 2027).
 *
 * `UblInvoiceModel` is the normalized intermediate representation that sits
 * between our DB rows and the wire format: `buildUblInvoice` produces it (then
 * serializes to UBL 2.1 XML) and `parseUblInvoice` reconstructs it from inbound
 * XML. Keeping both directions on one model means the validator can run against
 * a single shape regardless of direction.
 */

export type EinvoiceDirection = Database["public"]["Enums"]["einvoice_direction"]
export type EinvoiceTransportStatus =
  Database["public"]["Enums"]["einvoice_transport_status"]
export type EinvoiceValidationStatus =
  Database["public"]["Enums"]["einvoice_validation_status"]

/** A trading party (seller or buyer) — EN 16931 BG-4 / BG-7. */
export type PeppolParty = {
  name: string
  /** Peppol participant id, e.g. `0245:2020317068`. */
  peppolId?: string | null
  /** IČ DPH — VAT identifier (BT-31 / BT-48). */
  vatId?: string | null
  /** IČO — legal registration id (BT-30 / BT-47). */
  companyId?: string | null
  /** DIČ — tax registration id. */
  taxId?: string | null
  street?: string | null
  city?: string | null
  postalCode?: string | null
  /** ISO 3166-1 alpha-2, e.g. `SK`. */
  country: string
}

/** One invoice line — EN 16931 BG-25. */
export type UblLine = {
  position: number
  description: string
  quantity: number
  /** UN/ECE Rec 20 unit code is derived at serialization; this is our SK unit. */
  unit: string
  unitPrice: number
  vatRate: number
  /** Net line amount (BT-131). */
  lineNet: number
  /** UBL tax category code (S, AE, K, E, Z, G, O). */
  taxCategory: string
}

/** VAT breakdown row — EN 16931 BG-23. */
export type UblTaxSubtotal = {
  /** Percentage, e.g. 23. */
  rate: number
  /** Taxable base (BT-116). */
  base: number
  /** Tax amount (BT-117). */
  vat: number
  /** UBL tax category code. */
  category: string
}

export type VatMode = Database["public"]["Enums"]["vat_mode"]

export type UblInvoiceModel = {
  /** Invoice number (BT-1). Also used as the SK variabilný symbol. */
  number: string
  issueDate: string // YYYY-MM-DD (BT-2)
  dueDate?: string | null // BT-9
  supplyDate?: string | null // BT-72 (tax point / DUZP)
  currency: string // BT-5
  vatMode: VatMode
  note?: string | null // BT-22
  seller: PeppolParty
  buyer: PeppolParty
  iban?: string | null // BT-84
  bic?: string | null // BT-86
  /** Payment reference / variabilný symbol (BT-83). */
  paymentReference?: string | null
  lines: UblLine[]
  taxSubtotals: UblTaxSubtotal[]
  /** Sum of line net amounts (BT-106). */
  subtotal: number
  /** Total VAT (BT-110). */
  vatTotal: number
  /** Grand total payable (BT-112 / BT-115). */
  total: number
}

// ── Transport (Digitálny poštár / certified Access Point) ─────────────────────

export type SendResult = {
  messageId: string
  transportStatus: EinvoiceTransportStatus
}

export type InboundMessage = {
  messageId: string
  senderPeppolId: string | null
  receiverPeppolId: string | null
  xml: string
}

export type ParticipantLookup = {
  found: boolean
  name?: string | null
}

/**
 * Transport abstraction over a certified Slovak Digitálny poštár (Peppol Access
 * Point). v1 ships a `MockPostmanProvider` (sandbox); a real certified provider
 * is a drop-in implementation of this same interface — see §5.5. We deliberately
 * do NOT operate our own certified AP.
 */
export interface DigitalPostmanProvider {
  readonly name: string
  /** Hand a signed/validated UBL document to the AP for delivery. */
  send(
    xml: string,
    route: { senderPeppolId: string; receiverPeppolId: string },
  ): Promise<SendResult>
  /** Pull inbound documents addressed to `receiverPeppolId`. */
  receive(receiverPeppolId: string): Promise<InboundMessage[]>
  /** Current transport status of a previously-sent message. */
  status(messageId: string): Promise<EinvoiceTransportStatus>
  /** SML/SMP participant lookup — is this peppol id reachable? */
  lookupParticipant(peppolId: string): Promise<ParticipantLookup>
}

// ── Validation (EN 16931 + Peppol BIS + SK customizations) ────────────────────

export type ValidationSeverity = "error" | "warning"

export type ValidationError = {
  /** Rule id, e.g. `BR-02`, `BR-CO-15`, `PEPPOL-EN16931-R010`, `SK-R001`. */
  rule: string
  severity: ValidationSeverity
  message: string
  location?: string
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
}
