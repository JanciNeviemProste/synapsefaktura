/**
 * Výber sadzby cestovnej náhrady platnej k dátumu (čisté, bez I/O).
 *
 * Sadzba sa mení v čase a jazda z marca sa musí počítať sadzbou platnou
 * v marci, nie tou dnešnou. Preto má `travel_rates` platnosť od-do a preto sa
 * sem podáva dátum jazdy, nie „dnes".
 *
 * `organization_id` môže byť `null` — vtedy ide o zákonnú sadzbu platnú pre
 * všetkých. Vlastná sadzba organizácie má prednosť: firma sa môže dohodnúť na
 * vyššej než zákonnej, ale nikdy nie naopak bez toho, aby to sama nastavila.
 */

/** Zhodné s enumom `public.vehicle_category`. */
export type VehicleCategory = "passenger" | "motorcycle"

export interface TravelRate {
  /** `null` = zákonná sadzba platná pre všetkých. */
  organization_id: string | null
  /**
   * `null` = sadzba platí pre akékoľvek vozidlo. Tak sa zadáva vlastná sadzba
   * firmy; zákonné sadzby kategóriu vyplnenú majú, lebo zákon medzi osobným
   * autom a motocyklom rozlišuje.
   */
  vehicle_category: VehicleCategory | null
  /** ISO `YYYY-MM-DD`. */
  valid_from: string
  /** ISO `YYYY-MM-DD`, `null` = platí doteraz. */
  valid_to: string | null
  rate_per_km: number
  fuel_rate_per_km: number | null
  currency: string
  /**
   * Číslo predpisu, z ktorého sadzba pochádza (napr. `oznámenie 340/2025 Z. z.`).
   * Pri daňovej kontrole je to prvé, na čo sa pýtajú.
   */
  source_ref: string | null
  source_url: string | null
  /**
   * `null` = sadzbu našiel cron na stránke ministerstva, ale nikto ju ešte
   * nepotvrdil. Taká sa NEPOUŽÍVA — daňové číslo sa nemá zmeniť samo.
   */
  confirmed_at: string | null
}

/** Platí sadzba v zadaný deň? Hranice sú vrátane oboch. */
function coversDate(rate: TravelRate, onDate: string): boolean {
  if (rate.valid_from > onDate) return false
  if (rate.valid_to !== null && rate.valid_to < onDate) return false
  return true
}

/**
 * Sadzba platná k dátumu pre dané vozidlo, alebo `null`, keď žiadna neexistuje.
 *
 * Poradie rozhodovania:
 *  1. nepotvrdené sadzby vypadnú úplne — cron ich len navrhuje,
 *  2. sadzba pre KATEGÓRIU vozidla pred sadzbou bez kategórie. Zákon má pre
 *     motocykel 0,090 €/km oproti 0,313 pri osobnom aute, takže zámena je
 *     3,5-násobná chyba, nie zaokrúhlenie,
 *  3. vlastná sadzba organizácie pred zákonnou,
 *  4. pri viacerých rovnako oprávnených tá s neskorším `valid_from` — prekryv
 *     je chyba v zadaní a novšia je pravdepodobnejšie tá zamýšľaná.
 *
 * `null` sa ZÁMERNE nenahrádza nulou ani zabudovanou hodnotou: náhrada za km
 * je zákonné číslo a vymyslieť ho za používateľa by znamenalo tváriť sa, že
 * appka pozná sadzbu, ktorú jej nikto nezadal.
 */
export function resolveTravelRate(
  rates: TravelRate[],
  onDate: string,
  category: VehicleCategory = "passenger",
): TravelRate | null {
  const valid = rates.filter(
    (r) => r.confirmed_at !== null && coversDate(r, onDate),
  )
  if (valid.length === 0) return null

  // Presná kategória vyhráva. Sadzba bez kategórie je záloha pre vlastné
  // sadzby firmy, ktoré medzi vozidlami zvyčajne nerozlišujú.
  const exact = valid.filter((r) => r.vehicle_category === category)
  const byCategory =
    exact.length > 0 ? exact : valid.filter((r) => r.vehicle_category === null)
  if (byCategory.length === 0) return null

  const own = byCategory.filter((r) => r.organization_id !== null)
  const pool = own.length > 0 ? own : byCategory

  return pool.reduce((best, r) => (r.valid_from > best.valid_from ? r : best))
}
