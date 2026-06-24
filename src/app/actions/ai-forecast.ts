"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { formatMoney } from "@/lib/money"
import { generateStructured } from "@/lib/ai/generate"
import {
  computeForecast,
  type ComputeForecastInput,
  type ForecastResult,
} from "@/lib/forecast/forecast"

export interface GenerateForecastResult {
  ok: boolean
  data: ForecastResult | null
  narrative: string
  /** True when AI was unavailable and a deterministic narrative was used. */
  degraded: boolean
  error?: string
}

const OPEN_STATUSES = ["issued", "sent", "partially_paid", "overdue"] as const

const narrativeSchema = z.object({
  narrative: z
    .string()
    .describe("Krátky mesačný prehľad cashflow v slovenčine, 3-5 viet."),
})

/** Pull an estimated total from a recurring invoice's template JSON, if present. */
function recurringAmount(template: unknown): number | null {
  if (!template || typeof template !== "object") return null
  const t = template as Record<string, unknown>
  const direct = t.total ?? t.amount ?? t.grand_total
  if (typeof direct === "number" && direct > 0) return direct
  const items = t.items ?? t.lines
  if (Array.isArray(items)) {
    let sum = 0
    for (const it of items) {
      if (it && typeof it === "object") {
        const row = it as Record<string, unknown>
        const lineTotal = row.total ?? row.amount
        const qty = typeof row.quantity === "number" ? row.quantity : 1
        const price = typeof row.unit_price === "number" ? row.unit_price : null
        if (typeof lineTotal === "number") sum += lineTotal
        else if (price !== null) sum += price * qty
      }
    }
    if (sum > 0) return sum
  }
  return null
}

/** Build a deterministic SK narrative from the computed numbers (AI fallback). */
function heuristicNarrative(
  result: ForecastResult,
  horizonDays: number,
): string {
  const { buckets, totalReceivables, overdueTotal, behaviour } = result
  const inflow =
    horizonDays >= 90
      ? buckets.day90
      : horizonDays >= 60
        ? buckets.day60
        : buckets.day30

  const parts: string[] = []
  parts.push(
    `Očakávaný príjem za ${horizonDays} dní je ${formatMoney(inflow)} ` +
      `(30 dní: ${formatMoney(buckets.day30)}, 60 dní: ${formatMoney(
        buckets.day60,
      )}, 90 dní: ${formatMoney(buckets.day90)}).`,
  )
  parts.push(
    `Celkové pohľadávky predstavujú ${formatMoney(totalReceivables)}, ` +
      `z toho po splatnosti ${formatMoney(overdueTotal)}.`,
  )

  const slowPayers = behaviour
    .filter((b) => b.offsetDays > 0)
    .sort((a, b) => b.offsetDays - a.offsetDays)
    .slice(0, 2)
  if (slowPayers.length > 0) {
    const names = slowPayers
      .map((b) => `${b.name} (priem. +${b.offsetDays} dní)`)
      .join(", ")
    parts.push(`Najpomalšie platí: ${names}.`)
  }

  if (overdueTotal > 0) {
    parts.push(
      "Odporúčanie: pošlite upomienky na faktúry po splatnosti a zvážte skoršie " +
        "termíny splatnosti pre pomalých platcov.",
    )
  } else {
    parts.push(
      "Odporúčanie: cashflow je zdravý — sledujte termíny splatnosti a udržujte " +
        "pravidelnú fakturáciu.",
    )
  }

  return parts.join(" ")
}

/**
 * Generates a cash-flow forecast (§7.5): loads open receivables, payment history,
 * recurring invoices and contacts, runs the pure `computeForecast`, builds a SK
 * narrative (AI when available, deterministic otherwise) and persists a row in
 * `forecasts`. Returns the result for immediate rendering.
 */
export async function generateForecast(
  horizonDays = 90,
): Promise<GenerateForecastResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return {
      ok: false,
      data: null,
      narrative: "",
      degraded: true,
      error: "Chýba firma.",
    }
  }

  const [openRes, paidRes, recurringRes, contactsRes] = await Promise.all([
    supabase
      .from("documents")
      .select("contact_id, total, paid_amount, due_date")
      .eq("type", "invoice")
      .in("status", OPEN_STATUSES),
    supabase
      .from("documents")
      .select("contact_id, due_date, id, payments(paid_at)")
      .eq("type", "invoice")
      .eq("status", "paid"),
    supabase
      .from("recurring_invoices")
      .select("contact_id, next_run_at, template")
      .eq("active", true),
    supabase.from("contacts").select("id, name"),
  ])

  const invoices: ComputeForecastInput["invoices"] = (openRes.data ?? []).map(
    (d) => ({
      contactId: d.contact_id,
      total: d.total,
      paidAmount: d.paid_amount,
      dueDate: d.due_date,
    }),
  )

  // One sample per paid invoice: its due date vs. the latest recorded payment.
  const paidSamples: ComputeForecastInput["paidSamples"] = (
    paidRes.data ?? []
  ).map((d) => {
    const pays = (d.payments ?? []) as { paid_at: string | null }[]
    const latest = pays
      .map((p) => p.paid_at)
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1)
    return {
      contactId: d.contact_id,
      dueDate: d.due_date,
      paidAt: latest ?? null,
    }
  })

  const recurring: ComputeForecastInput["recurring"] = (
    recurringRes.data ?? []
  ).map((r) => ({
    contactId: r.contact_id,
    nextRunAt: r.next_run_at,
    amount: recurringAmount(r.template),
  }))

  const contacts: ComputeForecastInput["contacts"] = (
    contactsRes.data ?? []
  ).map((c) => ({ id: c.id, name: c.name }))

  const result = computeForecast(
    { invoices, paidSamples, recurring, contacts },
    new Date(),
  )

  // Narrative: prefer AI, fall back to a deterministic SK summary.
  let narrative = heuristicNarrative(result, horizonDays)
  let degraded = true

  const ai = await generateStructured({
    feature: "forecast",
    schema: narrativeSchema,
    system:
      "Si finančný asistent pre slovenskú firmu. Píš stručne a vecne po slovensky.",
    prompt:
      "Vytvor krátky 'Mesačný prehľad' cashflow (3-5 viet) z týchto údajov. " +
      "Spomeň očakávaný príjem, najväčších/najpomalších klientov, trend a 1-2 " +
      "konkrétne odporúčania. Údaje (JSON):\n" +
      JSON.stringify({
        horizonDays,
        buckets: result.buckets,
        totalReceivables: result.totalReceivables,
        overdueTotal: result.overdueTotal,
        behaviour: result.behaviour,
      }),
  })

  if (ai.ok) {
    narrative = ai.data.narrative
    degraded = false
  }

  await supabase.from("forecasts").insert({
    organization_id: orgId,
    horizon_days: horizonDays,
    data: result as unknown as Json,
    narrative,
  })

  return { ok: true, data: result, narrative, degraded }
}
