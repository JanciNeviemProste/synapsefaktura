"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  vehicleEventSchema,
  type VehicleEventInput,
} from "@/lib/validation/vehicle-event"

export type VehicleEventActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function paths(...vehicleIds: (string | null | undefined)[]) {
  revalidatePath("/app/logbook")
  for (const id of new Set(vehicleIds.filter(Boolean))) {
    revalidatePath(`/app/logbook/${id}`)
  }
}

/**
 * Overi, ze cudzi kluc patri tej istej organizacii. Samotny FK kontroluje len
 * existenciu riadku, nie firmu — a RLS pusti vsetky organizacie, ktorych je
 * pouzivatel clenom.
 */
async function belongsToOrg(
  supabase: SupabaseClient<Database>,
  table: "vehicles" | "expenses",
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

function toRow(v: ReturnType<typeof vehicleEventSchema.parse>) {
  return {
    vehicle_id: v.vehicleId,
    type: v.type,
    event_date: v.eventDate,
    description: v.description ?? null,
    cost: v.cost ?? null,
    odometer_km: v.odometerKm ?? null,
    expense_id: v.expenseId ?? null,
    next_due_on: v.nextDueOn ?? null,
  }
}

async function checkLinks(
  supabase: SupabaseClient<Database>,
  v: ReturnType<typeof vehicleEventSchema.parse>,
  orgId: string,
): Promise<string | null> {
  if (!(await belongsToOrg(supabase, "vehicles", v.vehicleId, orgId))) {
    return "Vozidlo sa nenašlo."
  }
  if (
    v.expenseId &&
    !(await belongsToOrg(supabase, "expenses", v.expenseId, orgId))
  ) {
    return "Náklad sa nenašiel."
  }
  return null
}

export async function createVehicleEvent(
  input: VehicleEventInput,
): Promise<VehicleEventActionResult> {
  const parsed = vehicleEventSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const linkError = await checkLinks(supabase, v, orgId)
  if (linkError) return { ok: false, error: linkError }

  const { data, error } = await supabase
    .from("vehicle_events")
    .insert({ organization_id: orgId, ...toRow(v) })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Udalosť sa nepodarilo uložiť." }

  paths(v.vehicleId)
  return { ok: true, id: data.id }
}

export async function updateVehicleEvent(
  id: string,
  input: VehicleEventInput,
): Promise<VehicleEventActionResult> {
  const parsed = vehicleEventSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: existing } = await supabase
    .from("vehicle_events")
    .select("vehicle_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Udalosť sa nenašla." }

  const linkError = await checkLinks(supabase, v, orgId)
  if (linkError) return { ok: false, error: linkError }

  const { error } = await supabase
    .from("vehicle_events")
    .update(toRow(v))
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Udalosť sa nepodarilo uložiť." }

  paths(existing.vehicle_id, v.vehicleId)
  return { ok: true, id }
}

export async function deleteVehicleEvent(
  id: string,
): Promise<VehicleEventActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: existing } = await supabase
    .from("vehicle_events")
    .select("vehicle_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Udalosť sa nenašla." }

  const { error } = await supabase
    .from("vehicle_events")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Udalosť sa nepodarilo zmazať." }

  paths(existing.vehicle_id)
  return { ok: true, id }
}
