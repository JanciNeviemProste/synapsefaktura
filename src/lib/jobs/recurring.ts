import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeInvoice } from "@/lib/vat/engine"
import { legalNoteForVatMode } from "@/lib/vat/legal-notes"
import {
  applyMergeTags,
  fromIsoDate,
  planRecurringRuns,
  toIsoDate,
  MAX_CATCH_UP_RUNS,
} from "@/lib/recurring/merge-tags"
import { recurringTemplateSchema } from "@/lib/validation/recurring"
import type { VatMode } from "@/lib/validation/org"
import { renderInvoicePdf } from "@/lib/pdf/render"
import { hasEmail, sendEmail } from "@/lib/email/provider"
import { invoiceEmail } from "@/lib/email/templates"
import { formatMoney } from "@/lib/money"

type Db = SupabaseClient<Database>
type RecurringRow = Database["public"]["Tables"]["recurring_invoices"]["Row"]

// Lokalny kalendarny den, nie UTC: `toISOString()` by pri vecernom behu v
// UTC+ zonach vratil predchadzajuci den a doklad by mal zly datum vystavenia.
function iso(d: Date): string {
  return toIsoDate(d)
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

export type DeliveryResult = {
  delivered: boolean
  /** Preco sa neodoslalo — do logu, nie do UI. */
  reason?: string
}

/**
 * Odosle uz vygenerovany doklad podla `send_method` sablony. Bez toho by
 * pravidelna faktura len lezala vystavena a cely zmysel bezzasahoveho
 * fakturovania by zanikol.
 *
 * Ide o TU ISTU cestu ako `markAsSent` (PDF cez lib/pdf/render, e-mail cez
 * lib/email) — ziadna druha implementacia odosielania.
 *
 * NIKDY nehadze: zlyhanie odoslania nesmie zhodit cron beh ani zrusit uz
 * vystavenu fakturu (cislo je pridelene, doklad plati aj neodoslany).
 */
export async function deliverRecurringDocument(
  db: Db,
  recurring: RecurringRow,
  documentId: string,
): Promise<DeliveryResult> {
  if (recurring.send_method === "none") {
    return { delivered: false, reason: "send_method=none" }
  }
  // Peppol provider je zatial mock (viz CLAUDE.md), takze skutocne odoslanie
  // do siete tu zamerne NEROBIME — doklad ostane vystaveny na rucne odoslanie.
  if (recurring.send_method === "peppol") {
    return { delivered: false, reason: "peppol zatial nepodporovany v crone" }
  }
  if (!hasEmail()) {
    return { delivered: false, reason: "chyba e-mailovy kluc" }
  }

  try {
    const rendered = await renderInvoicePdf(
      db,
      documentId,
      // Service-role klient obchadza RLS — bez organizacie by sa do PDF mohla
      // dostat hlavicka a IBAN cudzej firmy.
      recurring.organization_id,
    )
    if (!rendered) return { delivered: false, reason: "doklad sa nenacital" }
    const { buffer, doc, contact, org } = rendered

    if (!contact?.email) {
      return { delivered: false, reason: "odberatel nema e-mail" }
    }

    const { subject, html } = invoiceEmail({
      lang: doc.language,
      docNumber: doc.number ?? "—",
      supplierName: org.name,
      customerName: contact.name,
      total: formatMoney(doc.total, doc.currency),
      dueDate: doc.due_date ? doc.due_date.split("-").reverse().join(".") : "—",
    })
    const res = await sendEmail({
      to: contact.email,
      subject,
      html,
      attachments: [
        { filename: `${doc.number ?? "faktura"}.pdf`, content: buffer },
      ],
    })
    if (!res.ok) {
      const why = res.skipped ? "e-mail preskoceny" : res.error
      return { delivered: false, reason: why || "odoslanie zlyhalo" }
    }

    const { error } = await db
      .from("documents")
      .update({ status: "sent" })
      .eq("id", documentId)
      .eq("organization_id", recurring.organization_id)
    if (error) {
      // E-mail uz odisiel — stav sa len nepodarilo prepisat.
      return {
        delivered: true,
        reason: `stav neaktualizovany: ${error.message}`,
      }
    }
    return { delivered: true }
  } catch (err) {
    return {
      delivered: false,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Cron job: issue every active recurring invoice whose next_run_at is due.
 *
 * Rozvrh sa posuva od `next_run_at`, NIE od dnesku — inak by sa termin
 * postupne posuval a zameskane obdobia by sa ticho stratili. Zameskane
 * obdobia sa preto dobiehaju v cykle, najviac `MAX_CATCH_UP_RUNS` na jeden
 * beh a sablonu.
 */
export async function runRecurring(): Promise<{
  generated: number
  sent: number
  failed: number
}> {
  const admin = createAdminClient()
  const todayIso = iso(new Date())
  const { data: due, error: dueErr } = await admin
    .from("recurring_invoices")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", todayIso)

  if (dueErr) {
    console.error("[runRecurring] nacitanie splatnych sablon zlyhalo", {
      phase: "recurring:select",
      error: dueErr.message,
    })
    return { generated: 0, sent: 0, failed: 0 }
  }

  let generated = 0
  let sent = 0
  let failed = 0

  for (const r of due ?? []) {
    const plan = planRecurringRuns(
      r.next_run_at,
      todayIso,
      r.cadence,
      r.interval_days,
    )

    if (plan.capped) {
      console.error("[runRecurring] limit dobehnutych obdobi vycerpany", {
        recurringId: r.id,
        phase: "schedule:cap",
        maxCatchUpRuns: MAX_CATCH_UP_RUNS,
        nextRunAt: plan.nextRunAt,
      })
    }
    if (!plan.runDates.length) {
      failed++
      console.error("[runRecurring] splatna sablona bez pouzitelneho terminu", {
        recurringId: r.id,
        phase: "schedule:empty",
        nextRunAt: r.next_run_at,
      })
      continue
    }

    // Kolko terminov sa naozaj podarilo vystavit. Pri zlyhani uprostred sa
    // rozvrh posunie len po posledny uspesny termin, aby sa zvysok dobehol
    // v dalsom behu namiesto tichej straty.
    let done = 0
    for (const runIso of plan.runDates) {
      const runDate = fromIsoDate(runIso)
      if (!runDate) break

      const res = await generateFromRecurring(admin, r, runDate)
      if (!res.ok) {
        failed++
        console.error("[runRecurring] generovanie dokladu zlyhalo", {
          recurringId: r.id,
          phase: "generate",
          runDate: runIso,
          error: res.error,
        })
        break
      }
      generated++
      done++

      const delivery = await deliverRecurringDocument(admin, r, res.documentId!)
      if (delivery.delivered) sent++
      if (delivery.reason && r.send_method !== "none") {
        console.error("[runRecurring] odoslanie dokladu neprebehlo cisto", {
          recurringId: r.id,
          documentId: res.documentId,
          phase: "deliver",
          sendMethod: r.send_method,
          delivered: delivery.delivered,
          reason: delivery.reason,
        })
      }
    }

    if (done === 0) continue

    const nextRunAt =
      done === plan.runDates.length ? plan.nextRunAt : plan.runDates[done]
    const { error: updErr } = await admin
      .from("recurring_invoices")
      .update({ last_run_at: plan.runDates[done - 1], next_run_at: nextRunAt })
      .eq("id", r.id)
      .eq("organization_id", r.organization_id)
    if (updErr) {
      // Kriticke: neposunuty rozvrh znamena, ze dalsi beh vystavi tie iste
      // faktury znova.
      console.error("[runRecurring] posun rozvrhu zlyhal", {
        recurringId: r.id,
        phase: "schedule:update",
        nextRunAt,
        error: updErr.message,
      })
    }
  }

  return { generated, sent, failed }
}
