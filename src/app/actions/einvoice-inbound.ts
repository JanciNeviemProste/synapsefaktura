"use server"

import { revalidatePath } from "next/cache"

import type { Database, Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { receiveInboundForOrg } from "@/lib/jobs/peppol-inbound"
import { parseUblInvoice } from "@/lib/peppol/inbound"

export type InboundRow = Database["public"]["Tables"]["einvoices"]["Row"]

type InboundSummary = {
  number: string
  supplierName: string
  total: number
  currency: string
}

/**
 * Interactive "check my inbox" for the current org. Pulls from the org's
 * provider using its Peppol id and stores any new inbound documents. Returns
 * the number of newly received messages.
 */
export async function pollMyInbox(): Promise<{
  ok: boolean
  received: number
  error?: string
}> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, received: 0, error: "Chýba organizácia." }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, peppol_id, einvoice_enabled, digital_postman_provider")
    .eq("id", orgId)
    .maybeSingle()

  if (!org || !org.einvoice_enabled || !org.peppol_id) {
    return {
      ok: false,
      received: 0,
      error: "E-fakturácia nie je pre túto organizáciu zapnutá.",
    }
  }

  try {
    const received = await receiveInboundForOrg(supabase, {
      id: org.id,
      peppol_id: org.peppol_id,
      digital_postman_provider: org.digital_postman_provider,
    })
    revalidatePath("/app/einvoices")
    return { ok: true, received }
  } catch {
    return {
      ok: false,
      received: 0,
      error: "Nepodarilo sa skontrolovať schránku.",
    }
  }
}

/**
 * List inbound e-invoices for the current org (newest first), each with a parsed
 * summary (supplier, total, number) and whether an expense was already created.
 */
export async function listInbound(): Promise<
  Array<
    InboundRow & {
      summary: InboundSummary | null
      hasExpense: boolean
    }
  >
> {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from("einvoices")
    .select("*")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })

  return (rows ?? []).map((row) => {
    let summary: InboundSummary | null = null
    try {
      if (!row.ubl_xml) throw new Error("missing xml")
      const model = parseUblInvoice(row.ubl_xml)
      summary = {
        number: model.number,
        supplierName: model.seller.name,
        total: model.total,
        currency: model.currency,
      }
    } catch {
      summary = null
    }
    return { ...row, summary, hasExpense: row.expense_id != null }
  })
}

/**
 * Convert one inbound e-invoice into an expense (`source: 'peppol_inbound'`).
 * Idempotent: if the einvoice already links an expense, that id is returned.
 */
export async function inboundToExpense(
  einvoiceId: string,
): Promise<{ ok: boolean; expenseId?: string; error?: string }> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba organizácia." }

  const { data: einvoice } = await supabase
    .from("einvoices")
    .select("*")
    .eq("id", einvoiceId)
    .eq("direction", "inbound")
    .maybeSingle()

  if (!einvoice) return { ok: false, error: "E-faktúra sa nenašla." }
  if (einvoice.expense_id) {
    return { ok: true, expenseId: einvoice.expense_id }
  }

  let model
  try {
    if (!einvoice.ubl_xml) throw new Error("missing xml")
    model = parseUblInvoice(einvoice.ubl_xml)
  } catch {
    return { ok: false, error: "Nepodarilo sa načítať XML." }
  }

  const seller = model.seller

  // Match an existing supplier contact by Peppol id / IČ DPH / IČO.
  let supplierContactId: string | null = null
  const orFilters: string[] = []
  if (seller.peppolId) orFilters.push(`peppol_id.eq.${seller.peppolId}`)
  if (seller.vatId) orFilters.push(`ic_dph.eq.${seller.vatId}`)
  if (seller.companyId) orFilters.push(`ico.eq.${seller.companyId}`)

  if (orFilters.length > 0) {
    const { data: match } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .or(orFilters.join(","))
      .limit(1)
      .maybeSingle()
    if (match) supplierContactId = match.id
  }

  if (!supplierContactId) {
    const { data: created, error: contactErr } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        type: "supplier",
        name: seller.name || "Neznámy dodávateľ",
        ic_dph: seller.vatId,
        ico: seller.companyId,
        dic: seller.taxId,
        peppol_id: seller.peppolId,
        street: seller.street,
        city: seller.city,
        postal_code: seller.postalCode,
        country: seller.country,
      })
      .select("id")
      .single()
    if (contactErr || !created) {
      return { ok: false, error: "Nepodarilo sa vytvoriť dodávateľa." }
    }
    supplierContactId = created.id
  }

  const vatRateBreakdown = model.taxSubtotals.map((t) => ({
    rate: t.rate,
    base: t.base,
    vat: t.vat,
  }))

  const { data: expense, error: expenseErr } = await supabase
    .from("expenses")
    .insert({
      organization_id: orgId,
      supplier_contact_id: supplierContactId,
      document_number: model.number,
      issue_date: model.issueDate,
      supply_date: model.supplyDate,
      due_date: model.dueDate,
      currency: model.currency,
      subtotal: model.subtotal,
      vat_total: model.vatTotal,
      total: model.total,
      paid_amount: 0,
      status: "unpaid",
      vat_rate_breakdown: vatRateBreakdown as unknown as Json,
      category: null,
      tax_deductible: true,
      source: "peppol_inbound",
      notes: "Vytvorené z prijatej e-faktúry",
    })
    .select("id")
    .single()

  if (expenseErr || !expense) {
    return { ok: false, error: "Nepodarilo sa vytvoriť náklad." }
  }

  const { error: linkErr } = await supabase
    .from("einvoices")
    .update({ expense_id: expense.id })
    .eq("id", einvoiceId)
  if (linkErr) {
    return { ok: false, error: "Náklad bol vytvorený, ale prepojenie zlyhalo." }
  }

  revalidatePath("/app/einvoices")
  revalidatePath("/app/expenses")
  return { ok: true, expenseId: expense.id }
}
