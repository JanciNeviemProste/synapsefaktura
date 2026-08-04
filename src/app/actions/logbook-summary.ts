"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { auditLogbook, type LogbookFinding } from "@/lib/logbook/audit"

/**
 * Kontrola knihy jazd pred danovou kontrolou — nacita jazdy a tankovania
 * vozidla za obdobie a poda ich cistej funkcii `auditLogbook`.
 *
 * Citacia akcia: nic nezapisuje, takze ziadny `revalidatePath`. Kazdy dotaz ma
 * `.eq("organization_id", orgId)` — samotna RLS nestaci, pusti vsetky
 * organizacie, ktorych je pouzivatel clenom.
 */

/** ISO datum `YYYY-MM-DD`; taky format posiela aj `<input type="date">`. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Zadaj dátum v tvare RRRR-MM-DD.")

export const logbookSummarySchema = z
  .object({
    vehicleId: z.string().uuid("Vyber vozidlo."),
    periodFrom: isoDate,
    periodTo: isoDate,
  })
  .refine((v) => v.periodFrom <= v.periodTo, {
    path: ["periodTo"],
    message: "Koniec obdobia nesmie byť pred jeho začiatkom.",
  })

export type LogbookSummaryInput = z.input<typeof logbookSummarySchema>

export type LogbookSummaryResult =
  | { ok: true; findings: LogbookFinding[] }
  | { ok: false; error: string }

export async function auditVehicleLogbook(
  input: LogbookSummaryInput,
): Promise<LogbookSummaryResult> {
  const parsed = logbookSummarySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const { vehicleId, periodFrom, periodTo } = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("consumption_l_100km, odometer_km")
    .eq("id", vehicleId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (vehicleError) return { ok: false, error: "Údaje sa nepodarilo načítať." }
  if (!vehicle) return { ok: false, error: "Vozidlo sa nenašlo." }

  const [tripsRes, refuelingsRes] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "trip_date, distance_km, purpose, odometer_start_km, odometer_end_km",
      )
      .eq("organization_id", orgId)
      .eq("vehicle_id", vehicleId)
      .gte("trip_date", periodFrom)
      .lte("trip_date", periodTo)
      .order("trip_date", { ascending: true }),
    supabase
      .from("refuelings")
      .select("refueled_at, litres")
      .eq("organization_id", orgId)
      .eq("vehicle_id", vehicleId)
      .gte("refueled_at", periodFrom)
      .lte("refueled_at", periodTo)
      .order("refueled_at", { ascending: true }),
  ])

  if (tripsRes.error || refuelingsRes.error) {
    return { ok: false, error: "Údaje sa nepodarilo načítať." }
  }

  const findings = auditLogbook({
    vehicle: {
      consumptionPer100Km: vehicle.consumption_l_100km,
      odometerKm: vehicle.odometer_km,
    },
    trips: (tripsRes.data ?? []).map((t) => ({
      date: t.trip_date,
      km: t.distance_km ?? 0,
      purpose: t.purpose,
      odometerStart: t.odometer_start_km,
      odometerEnd: t.odometer_end_km,
    })),
    refuelings: (refuelingsRes.data ?? []).map((r) => ({
      date: r.refueled_at,
      litres: r.litres,
    })),
    periodFrom,
    periodTo,
  })

  return { ok: true, findings }
}
