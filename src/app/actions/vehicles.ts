"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { vehicleSchema, type VehicleInput } from "@/lib/validation/vehicle"

export type VehicleActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

const PATH = "/app/logbook"

/** Postgres kod pre porusenie unikatneho indexu. */
const UNIQUE_VIOLATION = "23505"

/** ECV je v ramci organizacie unikatne (`unique (organization_id, license_plate)`). */
const DUPLICATE_PLATE = "Vozidlo s týmto ECV už existuje."

function toRow(v: ReturnType<typeof vehicleSchema.parse>) {
  return {
    name: v.name,
    license_plate: v.licensePlate,
    fuel_type: v.fuelType,
    ownership: v.ownership,
    driver_name: v.driverName ?? null,
    consumption_l_100km: v.consumptionL100Km ?? null,
    odometer_km: v.odometerKm,
    vin: v.vin ?? null,
    note: v.note ?? null,
    active: v.active,
  }
}

export async function createVehicle(
  input: VehicleInput,
): Promise<VehicleActionResult> {
  const parsed = vehicleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("vehicles")
    .insert({ organization_id: orgId, ...toRow(parsed.data) })
    .select("id")
    .single()
  if (error) {
    return {
      ok: false,
      error:
        error.code === UNIQUE_VIOLATION
          ? DUPLICATE_PLATE
          : "Vozidlo sa nepodarilo uložiť.",
    }
  }
  revalidatePath(PATH)
  return { ok: true, id: data.id }
}

export async function updateVehicle(
  id: string,
  input: VehicleInput,
): Promise<VehicleActionResult> {
  const parsed = vehicleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { error } = await supabase
    .from("vehicles")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) {
    return {
      ok: false,
      error:
        error.code === UNIQUE_VIOLATION
          ? DUPLICATE_PLATE
          : "Vozidlo sa nepodarilo uložiť.",
    }
  }
  revalidatePath(PATH)
  return { ok: true, id }
}

/**
 * Zmaze vozidlo aj s jazdami, tankovaniami a udalostami (FK maju
 * `on delete cascade`). Kniha jazd je danovy podklad, takze mazanie je v RLS
 * vyhradene pre owner/admin.
 */
export async function deleteVehicle(id: string): Promise<VehicleActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Vozidlo sa nepodarilo zmazať." }
  revalidatePath(PATH)
  return { ok: true, id }
}
