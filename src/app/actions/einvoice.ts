"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { buildUblInvoice } from "@/lib/peppol/ubl"
import { validateUbl } from "@/lib/peppol/validate"
import { getPostmanProvider } from "@/lib/peppol/provider"
import { slovakPeppolId } from "@/lib/peppol/id"
import { gateFeature } from "@/lib/billing/gate"
import type { PlanTier } from "@/lib/billing/plans"
import type {
  ValidationResult,
  EinvoiceTransportStatus,
} from "@/lib/peppol/types"
import type { Database, Json } from "@/lib/supabase/database.types"

export type EInvoiceValidation = ValidationResult
export type EInvoiceRow = Database["public"]["Tables"]["einvoices"]["Row"]

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type DocumentItemRow = Database["public"]["Tables"]["document_items"]["Row"]
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"]
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
type BankAccountRow = Database["public"]["Tables"]["bank_accounts"]["Row"]

type LoadedContext = {
  document: DocumentRow
  items: DocumentItemRow[]
  organization: OrganizationRow
  contact: ContactRow | null
  bankAccount: BankAccountRow | null
}

/**
 * Load the document (RLS-scoped to the org), its items, the org, the contact
 * and the org's default bank account. Returns a Slovak error string on failure.
 */
async function loadContext(
  documentId: string,
): Promise<{ ok: true; ctx: LoadedContext } | { ok: false; error: string }> {
  const supabase = await createClient()

  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { ok: false, error: "Nemáte priradenú organizáciu." }
  }

  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle()

  if (!document) {
    return { ok: false, error: "Doklad sa nenašiel." }
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", document.organization_id)
    .maybeSingle()

  if (!organization) {
    return { ok: false, error: "Organizácia sa nenašla." }
  }

  const { data: items } = await supabase
    .from("document_items")
    .select("*")
    .eq("document_id", documentId)
    .order("position", { ascending: true })

  let contact: ContactRow | null = null
  if (document.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", document.contact_id)
      .maybeSingle()
    contact = data ?? null
  }

  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("organization_id", organization.id)
    .order("is_default", { ascending: false })

  const bankAccount =
    bankAccounts?.find((b) => b.is_default) ?? bankAccounts?.[0] ?? null

  return {
    ok: true,
    ctx: {
      document,
      items: items ?? [],
      organization,
      contact,
      bankAccount,
    },
  }
}

/**
 * Build UBL + validate WITHOUT sending (for the preview / validate button).
 */
export async function previewEInvoice(
  documentId: string,
): Promise<
  | { ok: true; xml: string; validation: ValidationResult }
  | { ok: false; error: string }
> {
  const loaded = await loadContext(documentId)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { document, items, organization, contact, bankAccount } = loaded.ctx

  const { model, xml } = buildUblInvoice({
    document,
    items,
    organization,
    contact,
    bankAccount,
  })
  const validation = validateUbl(model)

  return { ok: true, xml, validation }
}

/**
 * Build → validate → if invalid persist a failed row and return errors (do NOT
 * send) → else provider.send → persist outbound einvoices row.
 */
export async function sendEInvoice(documentId: string): Promise<
  | { ok: true; einvoiceId: string; transportStatus: EinvoiceTransportStatus }
  | {
      ok: false
      error: string
      validation?: ValidationResult
      upgrade?: PlanTier
    }
> {
  const loaded = await loadContext(documentId)
  if (!loaded.ok) return { ok: false, error: loaded.error }

  const { document, items, organization, contact, bankAccount } = loaded.ctx

  if (document.status === "draft") {
    return { ok: false, error: "Najprv vystavte doklad." }
  }

  const supabaseGate = await createClient()
  const gate = await gateFeature(supabaseGate, organization.id, "peppolSend")
  if (!gate.allowed) {
    return { ok: false, error: gate.reason, upgrade: gate.requiredTier }
  }

  const senderPeppolId =
    organization.peppol_id || slovakPeppolId(organization.dic)
  if (!senderPeppolId) {
    return { ok: false, error: "Nastavte si Peppol ID v nastaveniach." }
  }

  const receiverPeppolId = contact
    ? contact.peppol_id || slovakPeppolId(contact.dic)
    : null
  if (!receiverPeppolId) {
    return { ok: false, error: "Odberateľ nemá Peppol ID." }
  }

  const { model, xml } = buildUblInvoice({
    document,
    items,
    organization,
    contact,
    bankAccount,
  })
  const validation = validateUbl(model)

  const supabase = await createClient()

  if (!validation.valid) {
    await supabase.from("einvoices").insert({
      organization_id: organization.id,
      document_id: document.id,
      direction: "outbound",
      ubl_xml: xml,
      sender_peppol_id: senderPeppolId,
      receiver_peppol_id: receiverPeppolId,
      validation_status: "invalid",
      validation_errors: validation.errors as unknown as Json,
      transport_status: "failed",
      provider: organization.digital_postman_provider || "mock",
    })
    return {
      ok: false,
      error: "Doklad nespĺňa pravidlá e-faktúry.",
      validation,
    }
  }

  const provider = getPostmanProvider(organization.digital_postman_provider)

  let res
  try {
    res = await provider.send(xml, { senderPeppolId, receiverPeppolId })
  } catch {
    await supabase.from("einvoices").insert({
      organization_id: organization.id,
      document_id: document.id,
      direction: "outbound",
      ubl_xml: xml,
      sender_peppol_id: senderPeppolId,
      receiver_peppol_id: receiverPeppolId,
      validation_status: "valid",
      transport_status: "failed",
      provider: organization.digital_postman_provider || "mock",
      error: "Odoslanie cez Digitálneho poštára zlyhalo.",
    })
    return {
      ok: false,
      error: "E-faktúru sa nepodarilo odoslať. Skúste to znova.",
    }
  }

  const { data: inserted, error } = await supabase
    .from("einvoices")
    .insert({
      organization_id: organization.id,
      document_id: document.id,
      direction: "outbound",
      ubl_xml: xml,
      peppol_message_id: res.messageId,
      sender_peppol_id: senderPeppolId,
      receiver_peppol_id: receiverPeppolId,
      validation_status: "valid",
      transport_status: res.transportStatus,
      provider: organization.digital_postman_provider || "mock",
    })
    .select("id")
    .single()

  if (error || !inserted) {
    return { ok: false, error: "E-faktúru sa nepodarilo uložiť." }
  }

  revalidatePath(`/app/invoices/${documentId}`)

  return {
    ok: true,
    einvoiceId: inserted.id,
    transportStatus: res.transportStatus,
  }
}

/** Latest outbound einvoices row for a document (or null). */
export async function getEInvoice(
  documentId: string,
): Promise<EInvoiceRow | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("einvoices")
    .select("*")
    .eq("document_id", documentId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}
