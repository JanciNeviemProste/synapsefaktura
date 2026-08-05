/**
 * Odvodenie sadzby DPH zo súm na doklade (čisté, bez I/O).
 *
 * Vzniklo z konkrétnej chyby: pri AI vyťažení bločka sa pri nevyťaženej sadzbe
 * natvrdo dosadilo 23 %. Na potravinovom bločku (19 %) to bola tichá chyba
 * v daňovom podklade — a používateľ nemal ako spoznať, že číslo je odhad.
 *
 * Preto sa sadzba dopočíta len vtedy, keď to sumy jednoznačne dovolia, a inak
 * ostane nula. **Nula je viditeľná, 23 % nie.**
 */

/** Sadzby platné na Slovensku. Iná hodnota z dokladu vyjsť nemá. */
export const SK_VAT_RATES = [23, 19, 5, 0] as const

/**
 * Ako ďaleko smie byť vypočítané percento od platnej sadzby, aby sa na ňu
 * zaokrúhlilo. Pol percentuálneho bodu pokryje zaokrúhľovanie po haliroch,
 * ale nespojí 19 % s 23 %.
 */
const TOLERANCE_PP = 0.5

/**
 * Sadzba zo základu a dane, alebo `0`, keď sa nedá určiť spoľahlivo.
 *
 * Nula znamená „neviem", nie „nulová sadzba" — a presne tak sa aj správa:
 * používateľ ju v doklade uvidí a opraví.
 */
export function deriveVatRate(
  subtotal: number,
  vatTotal: number | null | undefined,
): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0
  if (vatTotal === null || vatTotal === undefined) return 0
  if (!Number.isFinite(vatTotal) || vatTotal <= 0) return 0

  const pct = (vatTotal / subtotal) * 100
  for (const rate of SK_VAT_RATES) {
    if (rate > 0 && Math.abs(pct - rate) <= TOLERANCE_PP) return rate
  }
  return 0
}
