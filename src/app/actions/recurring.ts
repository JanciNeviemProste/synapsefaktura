"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  recurringSchema,
  type RecurringInput,
} from "@/lib/validation/recurring"
import { generateFromRecurring } from "@/lib/jobs/recurring"
import { nextRunDate } from "@/lib/recurring/merge-tags"
import type { Json } from "@/lib/supabase/database.types"

export type RecurringActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }

function toRow(v: ReturnType<typeof recurringSchema.parse>) {
  return {
    name: v.name,
    contact_id: v.contactId ?? null,
    cadence: v.cadence,
    interval_days: v.intervalDays ?? null,
    next_run_at: v.nextRunAt,
    active: v.active,
    template: v.template as unknown as Json,
  }
}

export async function createRecurring(
  input: RecurringInput,
): Promise<RecurringActionResult> {
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { error } = await supabase
    .from("recurring_invoices")
    .insert({ organization_id: orgId, ...toRow(parsed.data) })
  if (error)
    return { ok: false, error: "Pravidelnú faktúru sa nepodarilo uložiť." }
  revalidatePath("/app/recurring")
  return { ok: true }
}

export async function updateRecurring(
  id: string,
  input: RecurringInput,
): Promise<RecurringActionResult> {
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from("recurring_invoices")
    .update(toRow(parsed.data))
    .eq("id", id)
  if (error)
    return { ok: false, error: "Pravidelnú faktúru sa nepodarilo uložiť." }
  revalidatePath("/app/recurring")
  return { ok: true }
}

export async function deleteRecurring(
  id: string,
): Promise<RecurringActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("recurring_invoices")
    .delete()
    .eq("id", id)
  if (error) return { ok: false, error: "Nepodarilo sa zmazať." }
  revalidatePath("/app/recurring")
  return { ok: true }
}

/** Generate an invoice from this recurring now and advance its schedule. */
export async function runRecurringNow(
  id: string,
): Promise<RecurringActionResult> {
  const supabase = await createClient()
  const { data: row } = await supabase
    .from("recurring_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!row) return { ok: false, error: "Pravidelná faktúra sa nenašla." }

  const today = new Date()
  const res = await generateFromRecurring(supabase, row, today)
  if (!res.ok) return { ok: false, error: res.error ?? "Generovanie zlyhalo." }

  const next = nextRunDate(today, row.cadence, row.interval_days)
  await supabase
    .from("recurring_invoices")
    .update({
      last_run_at: today.toISOString().slice(0, 10),
      next_run_at: next.toISOString().slice(0, 10),
    })
    .eq("id", id)

  revalidatePath("/app/recurring")
  revalidatePath("/app/invoices")
  return { ok: true, id: res.documentId }
}
