"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { documentSchema, type DocumentInput } from "@/lib/validation/document"
import { computeInvoice } from "@/lib/vat/engine"
import { legalNoteForVatMode } from "@/lib/vat/legal-notes"
import { gateDocumentIssue } from "@/lib/billing/gate"

export type SaveDocumentResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function saveDocument(
  input: DocumentInput,
  opts: { id?: string; issue?: boolean } = {},
): Promise<SaveDocumentResult> {
  const parsed = documentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // Recompute totals server-side — never trust amounts from the client.
  const computed = computeInvoice(
    v.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
      discountPct: i.discountPct,
    })),
    v.vatMode,
  )

  const lang = v.language === "en" ? "en" : "sk"
  const legalNote = legalNoteForVatMode(v.vatMode, lang)

  // Determine number / status. Assign a number atomically on first issue.
  let number: string | null = null
  let status: "draft" | "issued" = "draft"
  let wasIssued = false

  if (opts.id) {
    const { data: existing } = await supabase
      .from("documents")
      .select("number, status")
      .eq("id", opts.id)
      .maybeSingle()
    number = existing?.number ?? null
    status = (existing?.status as "draft" | "issued") ?? "draft"
    wasIssued = existing?.status === "issued"
  }

  // Plan limit applies to every first transition to "issued" (not re-saves of an
  // already-issued doc), regardless of whether a number was pre-assigned.
  if (opts.issue && !wasIssued) {
    const g = await gateDocumentIssue(supabase, orgId)
    if (!g.allowed) return { ok: false, error: g.reason }
  }

  if (opts.issue && !number) {
    const year = Number(v.issueDate.slice(0, 4))
    const { data: assigned, error: numErr } = await supabase.rpc(
      "next_document_number",
      { p_org: orgId, p_doc_type: v.type, p_year: year },
    )
    if (numErr) return { ok: false, error: "Nepodarilo sa prideliť číslo." }
    number = assigned
    status = "issued"
  } else if (opts.issue) {
    status = "issued"
  }

  const docRow = {
    organization_id: orgId,
    type: v.type,
    number,
    contact_id: v.contactId ?? null,
    issue_date: v.issueDate,
    supply_date: v.supplyDate || null,
    due_date: v.dueDate || null,
    currency: v.currency,
    exchange_rate: v.exchangeRate,
    language: v.language,
    vat_mode: v.vatMode,
    status,
    subtotal: computed.subtotal,
    vat_total: computed.vatTotal,
    total: computed.total,
    notes: v.notes || null,
    footer_notes: v.footerNotes || null,
    legal_notes: legalNote,
  }

  let documentId = opts.id

  if (documentId) {
    const { error } = await supabase
      .from("documents")
      .update(docRow)
      .eq("id", documentId)
    if (error) return { ok: false, error: "Doklad sa nepodarilo uložiť." }
    await supabase.from("document_items").delete().eq("document_id", documentId)
  } else {
    const { data, error } = await supabase
      .from("documents")
      .insert(docRow)
      .select("id")
      .single()
    if (error || !data)
      return { ok: false, error: "Doklad sa nepodarilo vytvoriť." }
    documentId = data.id
  }

  const itemRows = computed.lines.map((line, idx) => ({
    document_id: documentId!,
    position: idx,
    description: v.items[idx].description ?? "",
    quantity: line.quantity,
    unit: v.items[idx].unit ?? "ks",
    unit_price: line.unitPrice,
    vat_rate: line.effectiveVatRate,
    discount_pct: line.discountPct,
    line_base: line.lineBase,
    line_vat: line.lineVat,
    line_total: line.lineTotal,
    product_id: v.items[idx].productId ?? null,
  }))

  const { error: itemsErr } = await supabase
    .from("document_items")
    .insert(itemRows)
  if (itemsErr) return { ok: false, error: "Položky sa nepodarilo uložiť." }

  revalidatePath("/app/invoices")
  return { ok: true, id: documentId! }
}

export async function deleteDocument(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) return { ok: false, error: "Doklad sa nepodarilo zmazať." }
  revalidatePath("/app/invoices")
  return { ok: true }
}

/** Records full payment and marks the document paid. */
export async function markAsPaid(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("documents")
    .select("total")
    .eq("id", id)
    .maybeSingle()
  if (!doc) return { ok: false, error: "Doklad sa nenašiel." }

  await supabase
    .from("payments")
    .insert({ document_id: id, amount: doc.total, method: "bank" })
  const { error } = await supabase
    .from("documents")
    .update({ status: "paid", paid_amount: doc.total })
    .eq("id", id)
  if (error) return { ok: false, error: "Nepodarilo sa označiť ako uhradené." }
  revalidatePath("/app/invoices")
  revalidatePath(`/app/invoices/${id}`)
  return { ok: true }
}

/** Marks the document as sent (email delivery is a Phase-1 stub). */
export async function markAsSent(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  // TODO: wire real email delivery (SMTP/Resend) — for now just flips status.
  const { error } = await supabase
    .from("documents")
    .update({ status: "sent" })
    .eq("id", id)
  if (error) return { ok: false, error: "Nepodarilo sa odoslať." }
  revalidatePath(`/app/invoices/${id}`)
  return { ok: true }
}

/** Duplicates a document (and its items) as a fresh draft without a number. */
export async function duplicateDocument(
  id: string,
): Promise<SaveDocumentResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: src } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!src) return { ok: false, error: "Doklad sa nenašiel." }

  const { data: srcItems } = await supabase
    .from("document_items")
    .select("*")
    .eq("document_id", id)
    .order("position")

  const { data: created, error } = await supabase
    .from("documents")
    .insert({
      organization_id: orgId,
      type: src.type,
      number: null,
      contact_id: src.contact_id,
      issue_date: src.issue_date,
      supply_date: src.supply_date,
      due_date: src.due_date,
      currency: src.currency,
      exchange_rate: src.exchange_rate,
      language: src.language,
      vat_mode: src.vat_mode,
      status: "draft",
      subtotal: src.subtotal,
      vat_total: src.vat_total,
      total: src.total,
      notes: src.notes,
      footer_notes: src.footer_notes,
      legal_notes: src.legal_notes,
    })
    .select("id")
    .single()
  if (error || !created)
    return { ok: false, error: "Doklad sa nepodarilo duplikovať." }

  if (srcItems?.length) {
    await supabase.from("document_items").insert(
      srcItems.map((it) => ({
        document_id: created.id,
        position: it.position,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        discount_pct: it.discount_pct,
        line_base: it.line_base,
        line_vat: it.line_vat,
        line_total: it.line_total,
        product_id: it.product_id,
      })),
    )
  }

  revalidatePath("/app/invoices")
  return { ok: true, id: created.id }
}
