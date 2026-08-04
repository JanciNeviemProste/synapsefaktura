"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { gateFeature } from "@/lib/billing/gate"
import type { PlanTier } from "@/lib/billing/plans"
import {
  detectAnomalies,
  type Anomaly,
  type ExpenseLike,
  type InvoiceLike,
} from "@/lib/anomaly/detect"

/** How many recent rows to scan per entity. Enough for stats, bounded for perf. */
const SCAN_LIMIT = 200

export type ListAnomaliesResult =
  | { ok: true; anomalies: Anomaly[] }
  | { ok: false; error: string; upgrade?: PlanTier }

/**
 * Load recent invoices + expenses for the active org and run the pure anomaly
 * detector. Detektor nevola AI, takze sa nikdy nedostane cez gate v
 * `lib/ai/generate.ts` — platenu funkciu preto gatujeme rovno tu.
 */
export async function listAnomalies(): Promise<ListAnomaliesResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const gate = await gateFeature(supabase, orgId, "anomaly")
  if (!gate.allowed) {
    return { ok: false, error: gate.reason, upgrade: gate.requiredTier }
  }

  const [invoiceRes, expenseRes] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, number, type, total, subtotal, vat_total, contact_id, issue_date, vat_mode, contacts(name)",
      )
      .order("issue_date", { ascending: false, nullsFirst: false })
      .limit(SCAN_LIMIT),
    supabase
      .from("expenses")
      .select(
        "id, document_number, total, supplier_contact_id, issue_date, vat_rate_breakdown, contacts:supplier_contact_id(name)",
      )
      .order("issue_date", { ascending: false, nullsFirst: false })
      .limit(SCAN_LIMIT),
  ])

  if (invoiceRes.error || expenseRes.error) {
    return { ok: false, error: "Údaje sa nepodarilo načítať." }
  }

  const invoices: InvoiceLike[] = (invoiceRes.data ?? []).map((d) => ({
    id: d.id,
    number: d.number,
    type: d.type,
    total: d.total,
    subtotal: d.subtotal,
    vat_total: d.vat_total,
    contact_id: d.contact_id,
    issue_date: d.issue_date,
    vat_mode: d.vat_mode,
    contact_name: relatedName(d.contacts),
  }))

  const expenses: ExpenseLike[] = (expenseRes.data ?? []).map((e) => ({
    id: e.id,
    document_number: e.document_number,
    total: e.total,
    supplier_contact_id: e.supplier_contact_id,
    issue_date: e.issue_date,
    vat_rate_breakdown: e.vat_rate_breakdown,
    supplier_name: relatedName(e.contacts),
  }))

  return { ok: true, anomalies: detectAnomalies({ invoices, expenses }) }
}

/** Supabase returns embedded relations as object or array depending on cardinality. */
function relatedName(rel: unknown): string | null {
  if (!rel) return null
  const row = Array.isArray(rel) ? rel[0] : rel
  if (row && typeof row === "object" && "name" in row) {
    const name = (row as { name: unknown }).name
    return typeof name === "string" ? name : null
  }
  return null
}
