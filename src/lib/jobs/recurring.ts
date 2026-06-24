import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeInvoice } from "@/lib/vat/engine"
import { legalNoteForVatMode } from "@/lib/vat/legal-notes"
import { applyMergeTags, nextRunDate } from "@/lib/recurring/merge-tags"
import { recurringTemplateSchema } from "@/lib/validation/recurring"
import type { VatMode } from "@/lib/validation/org"

type Db = SupabaseClient<Database>
type RecurringRow = Database["public"]["Tables"]["recurring_invoices"]["Row"]

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return iso(d)
}

/**
 * Generates and issues one invoice from a recurring template (merge tags applied,
 * VAT engine recomputed, atomic number assigned). Works with a user or admin
 * client — the numbering RPC trusts service-role callers.
 */
export async function generateFromRecurring(
  db: Db,
  recurring: RecurringRow,
  runDate: Date,
): Promise<{ ok: boolean; documentId?: string; error?: string }> {
  const tpl = recurringTemplateSchema.safeParse(recurring.template)
  if (!tpl.success) return { ok: false, error: "Neplatná šablóna." }
  const t = tpl.data

  const items = t.items.map((i) => ({
    ...i,
    description: applyMergeTags(i.description, runDate),
  }))
  const computed = computeInvoice(
    items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
      discountPct: i.discountPct,
    })),
    t.vatMode,
  )

  const issueDate = iso(runDate)
  const year = runDate.getFullYear()
  const { data: number, error: numErr } = await db.rpc("next_document_number", {
    p_org: recurring.organization_id,
    p_doc_type: "invoice",
    p_year: year,
  })
  if (numErr) return { ok: false, error: "Nepodarilo sa prideliť číslo." }

  const lang = t.language === "en" ? "en" : "sk"
  const { data: doc, error } = await db
    .from("documents")
    .insert({
      organization_id: recurring.organization_id,
      type: "invoice",
      number,
      contact_id: recurring.contact_id,
      issue_date: issueDate,
      due_date: addDays(runDate, t.dueDays),
      currency: t.currency,
      language: t.language,
      vat_mode: t.vatMode as VatMode,
      status: "issued",
      subtotal: computed.subtotal,
      vat_total: computed.vatTotal,
      total: computed.total,
      notes: t.notes ? applyMergeTags(t.notes, runDate) : null,
      legal_notes: legalNoteForVatMode(t.vatMode, lang),
      source: "recurring",
    })
    .select("id")
    .single()
  if (error || !doc)
    return { ok: false, error: "Doklad sa nepodarilo vytvoriť." }

  const rows = computed.lines.map((line, idx) => ({
    document_id: doc.id,
    position: idx,
    description: items[idx].description,
    quantity: line.quantity,
    unit: items[idx].unit,
    unit_price: line.unitPrice,
    vat_rate: line.effectiveVatRate,
    discount_pct: line.discountPct,
    line_base: line.lineBase,
    line_vat: line.lineVat,
    line_total: line.lineTotal,
  }))
  await db.from("document_items").insert(rows)

  return { ok: true, documentId: doc.id }
}

/** Cron job: issue every active recurring invoice whose next_run_at is due. */
export async function runRecurring(): Promise<{ generated: number }> {
  const admin = createAdminClient()
  const today = new Date()
  const { data: due } = await admin
    .from("recurring_invoices")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", iso(today))

  let generated = 0
  for (const r of due ?? []) {
    const res = await generateFromRecurring(admin, r, today)
    if (res.ok) {
      generated++
      const next = nextRunDate(today, r.cadence, r.interval_days)
      await admin
        .from("recurring_invoices")
        .update({ last_run_at: iso(today), next_run_at: iso(next) })
        .eq("id", r.id)
    }
  }
  return { generated }
}
