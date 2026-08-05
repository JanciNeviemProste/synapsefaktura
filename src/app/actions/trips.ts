"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  tripSchema,
  ODOMETER_ORDER_MESSAGE,
  type TripInput,
} from "@/lib/validation/trip"

export type TripActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/** Postgres `check_violation` — v tejto tabulke ide o poradie stavov tachometra. */
const CHECK_VIOLATION = "23514"

function paths(...vehicleIds: (string | null | undefined)[]) {
  revalidatePath("/app/logbook")
  for (const id of new Set(vehicleIds.filter(Boolean))) {
    revalidatePath(`/app/logbook/${id}`)
  }
}

/**
 * Overi, ze cudzi kluc patri tej istej organizacii. Samotny FK kontroluje len
 * existenciu riadku, nie firmu — a RLS pusti vsetky organizacie, ktorych je
 * pouzivatel clenom. Bez tejto kontroly by sa dala jazda zapisat na vozidlo
 * inej firmy.
 */
async function belongsToOrg(
  supabase: SupabaseClient<Database>,
  table: "vehicles" | "contacts",
  id: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  return !!data
}

function toRow(v: ReturnType<typeof tripSchema.parse>) {
  return {
    vehicle_id: v.vehicleId,
    trip_date: v.tripDate,
    origin: v.origin ?? null,
    destination: v.destination ?? null,
    contact_id: v.contactId ?? null,
    distance_km: v.distanceKm,
    round_trip: v.roundTrip,
    with_trailer: v.withTrailer,
    purpose: v.purpose,
    purpose_note: v.purposeNote ?? null,
    driver_name: v.driverName ?? null,
    odometer_start_km: v.odometerStartKm ?? null,
    odometer_end_km: v.odometerEndKm ?? null,
  }
}

/** Rozlisi DB check poradia tachometra od ostatnych chyb zapisu. */
function writeError(code: string | undefined): string {
  return code === CHECK_VIOLATION
    ? ODOMETER_ORDER_MESSAGE
    : "Jazdu sa nepodarilo uložiť."
}

export async function createTrip(input: TripInput): Promise<TripActionResult> {
  const parsed = tripSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (!(await belongsToOrg(supabase, "vehicles", v.vehicleId, orgId))) {
    return { ok: false, error: "Vozidlo sa nenašlo." }
  }
  if (
    v.contactId &&
    !(await belongsToOrg(supabase, "contacts", v.contactId, orgId))
  ) {
    return { ok: false, error: "Klient sa nenašiel." }
  }

  const { data, error } = await supabase
    .from("trips")
    .insert({ organization_id: orgId, ...toRow(v) })
    .select("id")
    .single()
  if (error) return { ok: false, error: writeError(error.code) }

  paths(v.vehicleId)
  return { ok: true, id: data.id }
}

export async function updateTrip(
  id: string,
  input: TripInput,
): Promise<TripActionResult> {
  const parsed = tripSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: existing } = await supabase
    .from("trips")
    .select("vehicle_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Jazda sa nenašla." }

  if (!(await belongsToOrg(supabase, "vehicles", v.vehicleId, orgId))) {
    return { ok: false, error: "Vozidlo sa nenašlo." }
  }
  if (
    v.contactId &&
    !(await belongsToOrg(supabase, "contacts", v.contactId, orgId))
  ) {
    return { ok: false, error: "Klient sa nenašiel." }
  }

  const { error } = await supabase
    .from("trips")
    .update(toRow(v))
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: writeError(error.code) }

  // Jazda sa mohla presunut na ine vozidlo — prepocitat treba obidva detaily.
  paths(existing.vehicle_id, v.vehicleId)
  return { ok: true, id }
}

export async function deleteTrip(id: string): Promise<TripActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: existing } = await supabase
    .from("trips")
    .select("vehicle_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Jazda sa nenašla." }

  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Jazdu sa nepodarilo zmazať." }

  paths(existing.vehicle_id)
  return { ok: true, id }
}
