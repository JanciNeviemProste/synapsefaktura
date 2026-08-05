"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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
    vehicle_category: v.vehicleCategory ?? null,
    note: v.note || null,
    // Sadzba, ktorú používateľ napísal vlastnou rukou, je potvrdená z definície.
    // Bez tohto by ju `resolveTravelRate` ignorovala (potvrdenie je určené pre
    // sadzby nájdené cronom) a náhrada by sa po uložení stále nepočítala.
    confirmed_at: new Date().toISOString(),
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

/**
 * Zákonná sadzba, ktorú našiel cron a ešte ju nikto nepotvrdil.
 *
 * Vracia jeden riadok za osobné vozidlo — motocyklová sadzba k nemu patrí
 * (rovnaký `source_ref`) a potvrdí sa spolu s ním.
 */
export async function pendingStatutoryRate(): Promise<TravelRateRow | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return null

  const { data } = await supabase
    .from("travel_rates")
    .select("*")
    .is("organization_id", null)
    .is("confirmed_at", null)
    .eq("vehicle_category", "passenger")
    .order("valid_from", { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

/**
 * Potvrdí nájdenú zákonnú sadzbu — od tej chvíle sa začne používať.
 *
 * Potvrdzujú sa VŠETKY riadky s rovnakým `source_ref` naraz, teda aj sadzba
 * pre motocykel. Potvrdiť len jednu kategóriu by znamenalo, že sa polovica
 * vozidiel počíta novou sadzbou a polovica starou.
 *
 * Predchádzajúcej sadzbe sa zároveň nastaví `valid_to` na deň pred účinnosťou
 * novej. Bez toho by obe platili súčasne a rozhodovalo by poradie.
 *
 * Zákonná sadzba je globálna (`organization_id is null`), takže na ňu RLS
 * nepustí ani owner-a a zápis musí ísť cez service role. Rolový guard je preto
 * tu, v akcii. Potvrdenie platí pre všetky firmy — je to zákonný fakt rovnaký
 * pre každého a jeho zdrojom je ministerstvo, nie tá firma; kto chce iné
 * číslo, zadá si vlastnú sadzbu, ktorá má prednosť.
 */
export async function confirmStatutoryRate(
  id: string,
): Promise<TravelRateActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return { ok: false, error: "Nie si prihlásený." }

  const { data: me } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.user.id)
    .maybeSingle()
  if (me?.role !== "owner" && me?.role !== "admin") {
    return {
      ok: false,
      error: "Sadzbu môže potvrdiť len majiteľ alebo správca firmy.",
    }
  }

  const { data: proposed } = await supabase
    .from("travel_rates")
    .select("source_ref, valid_from")
    .eq("id", id)
    .is("organization_id", null)
    .is("confirmed_at", null)
    .maybeSingle()
  if (!proposed?.source_ref) {
    return { ok: false, error: "Návrh sadzby sa nenašiel." }
  }

  const admin = createAdminClient()

  // Predchádzajúca sadzba musí skončiť deň pred účinnosťou novej.
  const dayBefore = new Date(proposed.valid_from)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const closeAt = dayBefore.toISOString().slice(0, 10)

  const { error: closeError } = await admin
    .from("travel_rates")
    .update({ valid_to: closeAt })
    .is("organization_id", null)
    .is("valid_to", null)
    .not("confirmed_at", "is", null)
    .lt("valid_from", proposed.valid_from)
  if (closeError) {
    return { ok: false, error: "Sadzbu sa nepodarilo potvrdiť." }
  }

  const { error } = await admin
    .from("travel_rates")
    .update({ confirmed_at: new Date().toISOString() })
    .is("organization_id", null)
    .is("confirmed_at", null)
    .eq("source_ref", proposed.source_ref)
  if (error) return { ok: false, error: "Sadzbu sa nepodarilo potvrdiť." }

  revalidatePath(PATH)
  revalidatePath("/app/logbook")
  return { ok: true, id }
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
