/**
 * Kniha jazd — palivo a cestovne nahrady.
 *
 * Preco to niekomu zalezi: kniha jazd je danovy podklad. Pri kontrole sa
 * porovnava najazdene km x normovana spotreba (kombinovana spotreba z
 * technickeho preukazu) oproti realne nakupenemu palivu a uznat sa da len to
 * NIZSIE z tejto dvojice. Preto tu nestaci vratit jedno cislo — kontrolor chce
 * vidiet obidve strany, ktora rozhodla a aky je rozdiel.
 *
 * Konvencia pre chybajuce vstupy: `null`, nie 0. Nula by tvrdila, ze uznatelne
 * nie je nic; chybajuca spotreba znamena, ze sa este neda povedat nic.
 */

import { round, round2 } from "@/lib/money"

/** Ktora strana dvojice urcila uznatelne palivo. */
export type DeductibleBasis = "normed" | "purchased" | "equal"

export type DeductibleFuel = {
  /** Danovo uznatelne palivo v litroch = min(normovana, nakupena). */
  litres: number
  /** Normovana spotreba: km x spotreba / 100. */
  normedLitres: number
  /** Realne nakupene palivo podla dokladov. */
  purchasedLitres: number
  /** Ktora strana rozhodla — teda co je stropom. */
  basis: DeductibleBasis
  /** O kolko litrov sa strany lisia; to je neuznana cast. */
  difference: number
}

export type TravelReimbursement = {
  /** Zakladna nahrada za km: km x sadzba. */
  basicAmount: number
  /** Nahrada za spotrebovane palivo. */
  fuelAmount: number
  /** Spolu na vyplatenie. */
  total: number
}

/** Kladne konecne cislo (0 je v poriadku, zaporne km ani spotreba nie su). */
function isNonNegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

/**
 * Normovana spotreba paliva v litroch. Vrati `null`, ak spotreba vozidla nie
 * je vyplnena (alebo su vstupy nezmyselne) — bez spotreby z technickeho
 * preukazu sa normovana spotreba jednoducho neda vypocitat.
 */
export function normedFuelLitres(
  km: number,
  consumptionPer100Km: number | null | undefined,
): number | null {
  if (!isNonNegative(km)) return null
  if (!isNonNegative(consumptionPer100Km)) return null
  return round((km * consumptionPer100Km) / 100, 2)
}

/**
 * Danovo uznatelne palivo = to NIZSIE z dvojice (normovana spotreba, realne
 * nakupene palivo). Vrati aj obe strany, ktora rozhodla a rozdiel — presne to,
 * co pri kontrole pocita kontrolor.
 *
 * Vrati `null`, ked chyba spotreba vozidla. Nula by tvrdila, ze uznatelne nie
 * je nic, co je iny (a nepravdivy) vyrok nez "este to nevieme spocitat".
 */
export function deductibleFuel(input: {
  km: number
  consumption: number | null | undefined
  purchasedLitres: number
}): DeductibleFuel | null {
  const normedLitres = normedFuelLitres(input.km, input.consumption)
  if (normedLitres === null) return null
  if (!isNonNegative(input.purchasedLitres)) return null

  const purchasedLitres = round(input.purchasedLitres, 2)
  // Porovnavame az zaokruhlene hodnoty, inak by 12.000000000000002 vs 12
  // hlasilo rozdiel tam, kde ziadny nie je.
  const basis: DeductibleBasis =
    normedLitres === purchasedLitres
      ? "equal"
      : normedLitres < purchasedLitres
        ? "normed"
        : "purchased"

  return {
    litres: Math.min(normedLitres, purchasedLitres),
    normedLitres,
    purchasedLitres,
    basis,
    difference: round(Math.abs(normedLitres - purchasedLitres), 2),
  }
}

export type DeductibleBusinessFuel = DeductibleFuel & {
  /** Normovana spotreba za VSETKY km (sluzobne aj sukromne). */
  totalKm: number
  /** Kilometre, ktore zakladaju narok na odpocet. */
  businessKm: number
  /** Podiel sluzobnych jazd, 0..1. */
  businessShare: number
  /** Strop pred rozdelenim: min(normovana za vsetky km, nakupene). */
  eligibleLitres: number
}

/**
 * Danovo uznatelne palivo rozdelene na sluzobny podiel.
 *
 * PRECO SAMOSTATNA FUNKCIA: `deductibleFuel` porovnava normovanu spotrebu proti
 * nakupenemu palivu — to je fyzikalna otazka a odpoved na nu musi ratat VSETKY
 * kilometre. Danova otazka je az druha: ake percento z toho paliva sa smie
 * uplatnit.
 *
 * Zamienat tie dve veci znamena podat sluzobne km spolu s CELYM nakupenym
 * palivom — strop z nakupenej strany je potom umelo vysoky a odpocet vyjde
 * nadhodnoteny. Priklad: 6 l/100 km, 1000 km sluzobne + 1000 sukromne,
 * natankovanych 70 l. Nespravne: min(60, 70) = 60 l. Spravne:
 * min(120, 70) = 70 l stropu, z toho polovica sluzobne = 35 l.
 *
 * Tankovania nemaju priznak sluzobne/sukromne (a ani ho mat nemozu — z jednej
 * nadrze sa jazdi oboje), takze rozdelenie sa robi pomerom kilometrov.
 */
export function deductibleBusinessFuel(input: {
  totalKm: number
  businessKm: number
  consumption: number | null | undefined
  purchasedLitres: number
}): DeductibleBusinessFuel | null {
  if (!isNonNegative(input.totalKm)) return null
  if (!isNonNegative(input.businessKm)) return null

  const base = deductibleFuel({
    km: input.totalKm,
    consumption: input.consumption,
    purchasedLitres: input.purchasedLitres,
  })
  if (base === null) return null

  // Bez najazdenych kilometrov niet co delit; sluzobny podiel je nula, nie 1/0.
  // Sluzobne km nad ramec celkovych su nezmysel zo vstupu — orezeme na 1, nech
  // sa odpocet nikdy nenafukne nad strop.
  const businessShare =
    input.totalKm === 0 ? 0 : Math.min(input.businessKm / input.totalKm, 1)

  return {
    ...base,
    litres: round(base.litres * businessShare, 2),
    eligibleLitres: base.litres,
    totalKm: round(input.totalKm, 2),
    businessKm: round(input.businessKm, 2),
    businessShare: round(businessShare, 4),
  }
}

/**
 * Cestovna nahrada za jazdu: zakladna sadzba za km plus nahrada za palivo.
 * Vrati `null` pri nezmyselnych vstupoch (zaporne km alebo sadzba).
 */
export function travelReimbursement(input: {
  km: number
  ratePerKm: number
  fuelCost?: number | null
}): TravelReimbursement | null {
  if (!isNonNegative(input.km)) return null
  if (!isNonNegative(input.ratePerKm)) return null

  const fuelAmount = isNonNegative(input.fuelCost) ? round2(input.fuelCost) : 0
  const basicAmount = round2(input.km * input.ratePerKm)
  return {
    basicAmount,
    fuelAmount,
    total: round2(basicAmount + fuelAmount),
  }
}
