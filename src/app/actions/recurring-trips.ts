"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { writeOutcome } from "@/lib/supabase/affected"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import type { Database } from "@/lib/supabase/database.types"
import { planRecurringRuns, toIsoDate } from "@/lib/recurring/merge-tags"
import {
  recurringTripSchema,
  type RecurringTripInput,
} from "@/lib/validation/recurring-trip"

/**
 * Pravidelné jazdy — šablóny, z ktorých sa generujú zápisy do knihy jázd.
 *
 * Rozvrh počíta `planRecurringRuns`, tá istá funkcia ako pri pravidelných
 * faktúrach. Zámerne sa tu nepíše druhá implementácia: posúva sa vždy od
 * `next_run_on`, nie od dneška, takže rozvrh nedriftuje a zameškané obdobia
 * sa dobehnú namiesto toho, aby sa ticho stratili.
 */

export type RecurringTripActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export type GenerateTripsResult =
  | { ok: true; generated: number; capped: boolean }
  | { ok: false; error: string }

type RecurringTripRow =
  Database["public"]["Tables"]["recurring_trips"]["Row"]

function pathFor(vehicleId: string) {
  return `/app/logbook/${vehicleId}`
}

function toRow(v: ReturnType<typeof recurringTripSchema.parse>) {
  return {
    vehicle_id: v.vehicleId,
    cadence: v.cadence,
    origin: v.origin ?? null,
    destination: v.destination ?? null,
    contact_id: v.contactId ?? null,
    distance_km: v.distanceKm,
    round_trip: v.roundTrip,
    purpose: v.purpose,
    purpose_note: v.purposeNote ?? null,
    next_run_on: v.nextRunOn,
    active: v.active,
  }
}

/**
 * Overí, že cudzí kľúč patrí tej istej organizácii. Samotná RLS nestačí —
 * pustí všetky organizácie, ktorých je používateľ členom, takže bez tejto
 * kontroly by sa dala šablóna naviazať na vozidlo alebo klienta inej firmy.
 */
async function belongsToOrg(
  table: "vehicles" | "contacts",
  id: string,
  orgId: string,
): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  return Boolean(data)
}

export async function listRecurringTrips(
  vehicleId: string,
): Promise<RecurringTripRow[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const { data } = await supabase
    .from("recurring_trips")
    .select("*")
    .eq("organization_id", orgId)
    .eq("vehicle_id", vehicleId)
    .order("next_run_on", { ascending: true, nullsFirst: false })
  return data ?? []
}

export async function createRecurringTrip(
  input: RecurringTripInput,
): Promise<RecurringTripActionResult> {
  const parsed = recurringTripSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (!(await belongsToOrg("vehicles", v.vehicleId, orgId))) {
    return { ok: false, error: "Vozidlo sa nenašlo." }
  }
  if (v.contactId && !(await belongsToOrg("contacts", v.contactId, orgId))) {
    return { ok: false, error: "Klient sa nenašiel." }
  }

  const { data, error } = await supabase
    .from("recurring_trips")
    .insert({ organization_id: orgId, ...toRow(v) })
    .select("id")
    .single()
  if (error || !data) {
    return { ok: false, error: "Pravidelnú jazdu sa nepodarilo uložiť." }
  }

  revalidatePath(pathFor(v.vehicleId))
  return { ok: true, id: data.id }
}

export async function updateRecurringTrip(
  id: string,
  input: RecurringTripInput,
): Promise<RecurringTripActionResult> {
  const parsed = recurringTripSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (!(await belongsToOrg("vehicles", v.vehicleId, orgId))) {
    return { ok: false, error: "Vozidlo sa nenašlo." }
  }
  if (v.contactId && !(await belongsToOrg("contacts", v.contactId, orgId))) {
    return { ok: false, error: "Klient sa nenašiel." }
  }

  const { data, error } = await supabase
    .from("recurring_trips")
    .update(toRow(v))
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Pravidelnú jazdu sa nepodarilo uložiť." }
  }
  if (outcome.kind === "noRows") {
    return { ok: false, error: "Pravidelná jazda sa nenašla." }
  }

  revalidatePath(pathFor(v.vehicleId))
  return { ok: true, id }
}

export async function deleteRecurringTrip(
  id: string,
): Promise<RecurringTripActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("recurring_trips")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id, vehicle_id")
  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Pravidelnú jazdu sa nepodarilo zmazať." }
  }
  if (outcome.kind === "noRows") {
    // Mazanie ma politiku na owner/admin, takze "0 riadkov" znamena bud
    // chybajucu sablonu, alebo nedostatocnu rolu — rozlisi to existencia.
    const { data: exists } = await supabase
      .from("recurring_trips")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return {
      ok: false,
      error: exists
        ? "Na zmazanie pravidelnej jazdy nemáš oprávnenie."
        : "Pravidelná jazda sa nenašla.",
    }
  }

  const vehicleId = data?.[0]?.vehicle_id
  if (vehicleId) revalidatePath(pathFor(vehicleId))
  return { ok: true, id }
}

/**
 * Zapíše jazdy za všetky splatné termíny šablón daného vozidla.
 *
 * Spúšťa to používateľ z knihy jázd, nie cron: kniha jázd je daňový podklad
 * a zápis jazdy, ktorá sa možno neuskutočnila, by mal byť vedomý úkon. Preto
 * ani nie je automatický.
 *
 * Stav tachometra sa NEDOPĹŇA — šablóna ho nepozná a odhad by v daňovom
 * podklade vydával dohad za fakt.
 */
export async function generateDueTrips(
  vehicleId: string,
): Promise<GenerateTripsResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: templates, error } = await supabase
    .from("recurring_trips")
    .select("*")
    .eq("organization_id", orgId)
    .eq("vehicle_id", vehicleId)
    .eq("active", true)
  if (error) {
    return { ok: false, error: "Šablóny sa nepodarilo načítať." }
  }
  if (!templates || templates.length === 0) {
    return { ok: true, generated: 0, capped: false }
  }

  const today = toIsoDate(new Date())
  let generated = 0
  let capped = false

  for (const t of templates) {
    if (!t.next_run_on) continue

    const plan = planRecurringRuns(
      t.next_run_on,
      today,
      t.cadence as "weekly" | "monthly" | "custom",
      // `recurring_trips` vlastny stlpec pre interval nema — pri `custom`
      // pouzije planovac svoj default 30 dni.
      null,
    )
    if (plan.runDates.length === 0) continue
    if (plan.capped) capped = true

    const rows = plan.runDates.map((date) => ({
      organization_id: orgId,
      vehicle_id: t.vehicle_id,
      trip_date: date,
      origin: t.origin,
      destination: t.destination,
      contact_id: t.contact_id,
      distance_km: t.distance_km,
      round_trip: t.round_trip,
      purpose: t.purpose,
      purpose_note: t.purpose_note,
    }))

    const { error: insertError } = await supabase.from("trips").insert(rows)
    if (insertError) {
      // Rozvrh sa NEPOSUVA — dalsi pokus zacne tam, kde tento zlyhal, namiesto
      // toho, aby sa termin ticho stratil.
      console.error("[generateDueTrips] jazdy sa nepodarilo zapisat", {
        recurringTripId: t.id,
        vehicleId,
        runDates: plan.runDates,
        error: insertError.message,
      })
      continue
    }
    generated += rows.length

    await supabase
      .from("recurring_trips")
      .update({ next_run_on: plan.nextRunAt })
      .eq("id", t.id)
      .eq("organization_id", orgId)
  }

  revalidatePath(pathFor(vehicleId))
  return { ok: true, generated, capped }
}
