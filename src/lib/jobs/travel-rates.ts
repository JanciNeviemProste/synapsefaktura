import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  parseStatutoryRates,
  isNewerStatutoryRate,
} from "@/lib/logbook/rate-source"

/**
 * Kontrola, či ministerstvo nezmenilo zákonnú sadzbu cestovnej náhrady.
 *
 * Sadzba sa NIKDY nezmení sama. Nájdená sa zapíše ako **nepotvrdená**
 * (`confirmed_at is null`) a `resolveTravelRate` ju ignoruje, kým ju človek
 * v Nastaveniach nepotvrdí. Do potvrdenia sa počíta starou sadzbou.
 *
 * Dôvod: je to daňové číslo. Keby sa stránka ministerstva prekopala a parser
 * chytil nesprávnu hodnotu, tichá zmena by sa prejavila až v nesprávne
 * vypočítaných náhradách — a nikto by nevedel prečo.
 *
 * Beží so service role, lebo zákonná sadzba má `organization_id is null`
 * a RLS zápis takého riadku nepustí (a správne — nie je to dáta firmy).
 */

/** Stránka MPSVR, ktorá zmenu oznamuje ako prvá. */
const SOURCE_URL =
  "https://www.employment.gov.sk/sk/praca-zamestnanost/vztah-zamestnanca-zamestnavatela/cestovne-nahrady/urcenie-sum-nahrad-8/upozornenie-zvysenie-sum-zakladnej-nahrady.html"

const FETCH_TIMEOUT_MS = 10_000

export type TravelRateCheckResult = {
  checked: true
  /** Pribudol návrh na potvrdenie? */
  proposed: boolean
  /** Prečo sa nič nezapísalo (pri `proposed: false`). */
  reason?: string
  sourceRef?: string
  validFrom?: string
}

export async function checkStatutoryTravelRates(): Promise<TravelRateCheckResult> {
  let html: string
  try {
    const res = await fetch(SOURCE_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) {
      return { checked: true, proposed: false, reason: `HTTP ${res.status}` }
    }
    html = await res.text()
  } catch (e) {
    return {
      checked: true,
      proposed: false,
      reason: `stránka sa nenačítala: ${e instanceof Error ? e.message : "neznáma chyba"}`,
    }
  }

  const parsed = parseStatutoryRates(html)
  if (!parsed.ok) {
    // Rozbité parsovanie je dôvod pozrieť sa na to, nie ticho pokračovať.
    console.error("[travel-rates] stránku sa nepodarilo prečítať", {
      reason: parsed.reason,
      url: SOURCE_URL,
    })
    return { checked: true, proposed: false, reason: parsed.reason }
  }

  const admin = createAdminClient()

  // Najnovšia zákonná sadzba pre osobné vozidlo — podľa nej sa posudzuje,
  // či je nájdená naozaj novšia.
  const { data: currentRows, error: currentError } = await admin
    .from("travel_rates")
    .select("valid_from, rate_per_km, source_ref")
    .is("organization_id", null)
    .eq("vehicle_category", "passenger")
    .not("confirmed_at", "is", null)
    .order("valid_from", { ascending: false })
    .limit(1)
  if (currentError) {
    return { checked: true, proposed: false, reason: "sadzby sa nenačítali" }
  }

  const current = currentRows?.[0]
    ? {
        validFrom: currentRows[0].valid_from,
        passenger: currentRows[0].rate_per_km,
        sourceRef: currentRows[0].source_ref,
      }
    : null

  const verdict = isNewerStatutoryRate(parsed.rates, current)
  if (!verdict.ok) {
    return { checked: true, proposed: false, reason: verdict.reason }
  }

  // Návrh mohol pribudnúť už pri minulom behu a nikto ho zatiaľ nepotvrdil.
  const { data: existing } = await admin
    .from("travel_rates")
    .select("id")
    .is("organization_id", null)
    .eq("source_ref", parsed.rates.sourceRef)
    .limit(1)
  if (existing && existing.length > 0) {
    return {
      checked: true,
      proposed: false,
      reason: "návrh na túto sadzbu už čaká na potvrdenie",
      sourceRef: parsed.rates.sourceRef,
    }
  }

  const detectedAt = new Date().toISOString()
  const { error: insertError } = await admin.from("travel_rates").insert([
    {
      organization_id: null,
      vehicle_category: "passenger" as const,
      valid_from: parsed.rates.validFrom,
      valid_to: null,
      rate_per_km: parsed.rates.passenger,
      currency: "EUR",
      source_ref: parsed.rates.sourceRef,
      source_url: SOURCE_URL,
      note: "Nájdené automaticky na stránke ministerstva. Pred použitím potvrď.",
      detected_at: detectedAt,
      confirmed_at: null,
    },
    {
      organization_id: null,
      vehicle_category: "motorcycle" as const,
      valid_from: parsed.rates.validFrom,
      valid_to: null,
      rate_per_km: parsed.rates.motorcycle,
      currency: "EUR",
      source_ref: parsed.rates.sourceRef,
      source_url: SOURCE_URL,
      note: "Nájdené automaticky na stránke ministerstva. Pred použitím potvrď.",
      detected_at: detectedAt,
      confirmed_at: null,
    },
  ])
  if (insertError) {
    console.error("[travel-rates] navrh sa nepodarilo zapisat", {
      error: insertError.message,
      sourceRef: parsed.rates.sourceRef,
    })
    return {
      checked: true,
      proposed: false,
      reason: "návrh sa nepodarilo uložiť",
    }
  }

  console.log(
    "[travel-rates] najdena nova zakonna sadzba, caka na potvrdenie",
    {
      sourceRef: parsed.rates.sourceRef,
      validFrom: parsed.rates.validFrom,
      passenger: parsed.rates.passenger,
      motorcycle: parsed.rates.motorcycle,
    },
  )

  return {
    checked: true,
    proposed: true,
    sourceRef: parsed.rates.sourceRef,
    validFrom: parsed.rates.validFrom,
  }
}
