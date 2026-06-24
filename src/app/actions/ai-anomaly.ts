"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  detectAnomalies,
  type Anomaly,
  type ExpenseLike,
  type InvoiceLike,
} from "@/lib/anomaly/detect"

/** How many recent rows to scan per entity. Enough for stats, bounded for perf. */
const SCAN_LIMIT = 200

/**
 * Load recent invoices + expenses for the active org and run the pure anomaly
 * detector. Returns [] when there's no org or on any failure (graceful).
 */
export async function listAnomalies(): Promise<Anomaly[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

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

  if (invoiceRes.error || expenseRes.error) return []

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

  return detectAnomalies({ invoices, expenses })
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
