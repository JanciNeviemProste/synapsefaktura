"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { writeOutcome } from "@/lib/supabase/affected"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import type { Database } from "@/lib/supabase/database.types"
import {
  travelRateSchema,
  type TravelRateInput,
} from "@/lib/validation/travel-rate"

/**
 * Sadzby cestovných náhrad.
 *
 * `travel_rates.organization_id` môže byť `null` — vtedy ide o zákonnú sadzbu
 * platnú pre všetkých. Tá sa odtiaľto NIKDY nezapisuje ani nemaže: RLS ju
 * chráni (`insert`/`update`/`delete` vyžadujú `organization_id is not null`)
 * a mení ju len migrácia alebo service role. Zápisy tu preto vždy nesú
 * `organization_id` aktívnej firmy.
 */

export type TravelRateActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

type TravelRateRow = Database["public"]["Tables"]["travel_rates"]["Row"]

const PATH = "/app/settings"

function toRow(v: ReturnType<typeof travelRateSchema.parse>) {
  return {
    valid_from: v.validFrom,
    valid_to: v.validTo || null,
    rate_per_km: v.ratePerKm,
    fuel_rate_per_km: v.fuelRatePerKm ?? null,
    currency: v.currency,
    note: v.note || null,
  }
}

/**
 * Sadzby viditeľné pre aktívnu firmu — vlastné aj zákonné.
 *
 * Zákonné (`organization_id is null`) sa načítavajú ZÁMERNE: bez nich by
 * `resolveTravelRate` nemal z čoho vybrať a firma, ktorá si vlastnú sadzbu
 * nezadala, by nedostala žiadnu náhradu.
 */
export async function listTravelRates(): Promise<TravelRateRow[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const { data } = await supabase
    .from("travel_rates")
    .select("*")
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order("valid_from", { ascending: false })
  return data ?? []
}

export async function createTravelRate(
  input: TravelRateInput,
): Promise<TravelRateActionResult> {
  const parsed = travelRateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("travel_rates")
    .insert({ organization_id: orgId, ...toRow(parsed.data) })
    .select("id")
    .single()
  if (error || !data) {
    return { ok: false, error: "Sadzbu sa nepodarilo uložiť." }
  }

  revalidatePath(PATH)
  return { ok: true, id: data.id }
}

export async function updateTravelRate(
  id: string,
  input: TravelRateInput,
): Promise<TravelRateActionResult> {
  const parsed = travelRateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // `.select("id")` nie je kozmetika: PostgREST pri zapise odfiltrovanom RLS
  // nevrati chybu, len nezmeni ziadny riadok. Bez toho by sa zakonna sadzba
  // "upravila" s hlaskou o uspechu a nic by sa nestalo.
  const { data, error } = await supabase
    .from("travel_rates")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Sadzbu sa nepodarilo uložiť." }
  }
  if (outcome.kind === "noRows") {
    return {
      ok: false,
      error: "Sadzba sa nenašla. Zákonnú sadzbu upraviť nemožno.",
    }
  }

  revalidatePath(PATH)
  return { ok: true, id }
}

export async function deleteTravelRate(
  id: string,
): Promise<TravelRateActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("travel_rates")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Sadzbu sa nepodarilo zmazať." }
  }
  if (outcome.kind === "noRows") {
    // Mazanie ma politiku na owner/admin, takze "0 riadkov" znamena bud
    // chybajucu sadzbu, alebo nedostatocnu rolu. Rozlisi to existencia riadku.
    const { data: exists } = await supabase
      .from("travel_rates")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return {
      ok: false,
      error: exists
        ? "Na zmazanie sadzby nemáš oprávnenie."
        : "Sadzba sa nenašla.",
    }
  }

  revalidatePath(PATH)
  return { ok: true, id }
}
