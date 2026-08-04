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

export interface TravelRate {
  /** `null` = zákonná sadzba platná pre všetkých. */
  organization_id: string | null
  /** ISO `YYYY-MM-DD`. */
  valid_from: string
  /** ISO `YYYY-MM-DD`, `null` = platí doteraz. */
  valid_to: string | null
  rate_per_km: number
  fuel_rate_per_km: number | null
  currency: string
}

/** Platí sadzba v zadaný deň? Hranice sú vrátane oboch. */
function coversDate(rate: TravelRate, onDate: string): boolean {
  if (rate.valid_from > onDate) return false
  if (rate.valid_to !== null && rate.valid_to < onDate) return false
  return true
}

/**
 * Sadzba platná k dátumu, alebo `null`, keď žiadna neexistuje.
 *
 * Poradie rozhodovania:
 *  1. vlastná sadzba organizácie pred zákonnou,
 *  2. pri viacerých rovnako oprávnených tá s neskorším `valid_from` — prekryv
 *     je chyba v zadaní a novšia je pravdepodobnejšie tá zamýšľaná.
 *
 * `null` sa ZÁMERNE nenahrádza nulou ani zabudovanou hodnotou: náhrada za km
 * je zákonné číslo a vymyslieť ho za používateľa by znamenalo tváriť sa, že
 * appka pozná sadzbu, ktorú jej nikto nezadal.
 */
export function resolveTravelRate(
  rates: TravelRate[],
  onDate: string,
): TravelRate | null {
  const valid = rates.filter((r) => coversDate(r, onDate))
  if (valid.length === 0) return null

  const own = valid.filter((r) => r.organization_id !== null)
  const pool = own.length > 0 ? own : valid

  return pool.reduce((best, r) =>
    r.valid_from > best.valid_from ? r : best,
  )
}
