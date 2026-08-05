/**
 * Doplnenie cenníka z položiek dokladu (čisté, bez I/O).
 *
 * Keď používateľ napíše položku raz, appka mu ju má nabudúce ponúknuť. Cenník
 * (`products`) je presne to miesto, kde takéto položky patria — je editovateľný,
 * viditeľný a už dnes slúži ako zdroj pre „Pridať z cenníka". Preto sa nová
 * položka pridá sem, nie do nejakého skrytého zoznamu histórie.
 *
 * Čo sa NEPRIDÁ a prečo:
 * - položka bez popisu — nemá čo ponúkať,
 * - položka s nulovou cenou — obvykle medzisúčet alebo poznámka v riadku,
 * - popis, ktorý v cenníku už je (bez ohľadu na veľkosť písmen a medzery) —
 *   inak by sa cenník po pár dokladoch zaplnil desiatimi variantmi „Doprava".
 */

export interface PriceListCandidate {
  description: string
  unit: string
  unitPrice: number
  vatRate: number
}

export interface PriceListEntry {
  name: string
  unit: string
  unit_price: number
  vat_rate: number
}

/** Porovnávací tvar názvu: bez okrajových medzier, jedna medzera, malé písmená. */
function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Ktoré položky dokladu majú pribudnúť do cenníka.
 *
 * `existingNames` sú názvy, ktoré v cenníku už sú. Duplicity sa odfiltrujú aj
 * v rámci jedného dokladu — dva rovnaké riadky pridajú jednu položku.
 */
export function newPriceListEntries(
  items: PriceListCandidate[],
  existingNames: string[],
): PriceListEntry[] {
  const seen = new Set(existingNames.map(normalizeName))
  const out: PriceListEntry[] = []

  for (const item of items) {
    const name = item.description.trim()
    if (name === "") continue
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) continue

    const key = normalizeName(name)
    if (seen.has(key)) continue

    seen.add(key)
    out.push({
      name,
      unit: item.unit?.trim() || "ks",
      unit_price: item.unitPrice,
      vat_rate: item.vatRate,
    })
  }

  return out
}
