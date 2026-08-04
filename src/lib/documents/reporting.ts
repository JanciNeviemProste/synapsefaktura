/**
 * Ktoré typy dokladov vstupujú do výkazov a exportov (čisté, bez I/O).
 *
 * Dashboard, reporty aj účtovné exporty si donedávna filtrovali `type = 'invoice'`
 * každý sám. Vystavený dobropis tak neznížil ani vykázaný obrat, ani DPH —
 * doklad, ktorého jediným zmyslom je znižovať základ dane, sa do výkazu vôbec
 * nedostal. Preto je zoznam na jednom mieste: keď sa rozhodnutie zmení, zmení sa
 * raz, nie na štyroch miestach s rizikom, že jedno sa zabudne.
 *
 * Dobropis netreba pri sčítaní nijako zvlášť ošetrovať — `conversionQuantitySign`
 * mu pri prevode neguje množstvo, takže má záporný základ aj DPH a do súčtu
 * vstúpi so správnym znamienkom sám.
 */

import type { DocumentType } from "@/lib/documents/labels"

/**
 * Doklady, ktoré sú účtovným (daňovým) dokladom, a teda patria do výkazov.
 *
 * ZÁMERNE tu NIE JE:
 * - `proforma` a `advance` — zálohová faktúra nie je daňový doklad, sama
 *   nezakladá daňovú povinnosť. Do obratu ani DPH nepatrí.
 * - `tax_doc_payment` — daňový doklad k prijatej platbe daňovým dokladom je,
 *   ale appka zatiaľ nevie odpočítať zálohu na konečnej faktúre. Kým to
 *   nevie, jeho zahrnutie by pri postupe „proforma → daňový doklad → konečná
 *   faktúra" vykázalo tú istú tržbu dvakrát. Nadhodnotená DPH je horšia chyba
 *   než chýbajúci riadok, tak zostáva vonku, kým odpočet zálohy nepribudne.
 * - `quote`, `order_issued`, `order_received`, `delivery_note` — nie sú
 *   účtovné doklady vôbec.
 * - `draft` — rozrobený doklad; `computeSummary` navyše vyhadzuje aj stav
 *   `draft`, takže by neprešiel ani tak.
 */
export const REPORTED_DOCUMENT_TYPES = [
  "invoice",
  "credit_note",
] as const satisfies readonly DocumentType[]

/** Vstupuje doklad tohto typu do výkazov a exportov? */
export function isReportedDocumentType(type: DocumentType): boolean {
  return (REPORTED_DOCUMENT_TYPES as readonly DocumentType[]).includes(type)
}
