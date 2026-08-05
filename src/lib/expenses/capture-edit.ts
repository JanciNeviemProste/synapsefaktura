/**
 * Úpravy vyťaženého dokladu pred potvrdením (čisté, bez UI).
 *
 * PREČO VÔBEC: dialóg vyťaženia dovtedy hodnoty len VYPISOVAL a pod nimi
 * stálo „Skontroluj údaje". Skontrolovať sa dali, opraviť nie — pri jedinej
 * zle prečítanej číslici zostalo na výber prijať nesprávny doklad, alebo
 * zahodiť aj to, čo AI prečítala správne, a napísať všetko ručne.
 */

import type { ExtractedDocument } from "@/lib/ai/extractor"

/** Polia dokladu, ktoré smie používateľ prepísať. */
export type EditableField =
  | "supplierName"
  | "supplierIco"
  | "documentNumber"
  | "issueDate"
  | "dueDate"
  | "subtotal"
  | "vatTotal"
  | "total"

const MONEY_FIELDS: EditableField[] = ["subtotal", "vatTotal", "total"]

/**
 * Číslo z toho, čo človek naozaj napíše.
 *
 * Slovenská klávesnica píše desatinnú ČIARKU a zo sumy sa bežne skopíruje aj
 * mena či medzera na tisícky. `Number("12,50")` je `NaN`, takže by sa taký
 * vstup ticho zmenil na prázdnu hodnotu.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input
    .replace(/\s| /g, "")
    .replace(/[€$£]/g, "")
    .replace(",", ".")
  if (cleaned === "" || cleaned === "-") return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** Hodnota poľa v tvare pre textové pole formulára. */
export function fieldToInput(
  doc: ExtractedDocument,
  field: EditableField,
): string {
  const value = doc[field]
  if (value === null || value === undefined) return ""
  return String(value)
}

/**
 * Doklad s jedným prepísaným poľom.
 *
 * Prázdne pole znamená „na doklade to nie je“ (`null`), nie nulu — nula pri
 * sume je tvrdenie o dani, prázdno je priznanie, že údaj chýba.
 */
export function applyEdit(
  doc: ExtractedDocument,
  field: EditableField,
  input: string,
): ExtractedDocument {
  if (MONEY_FIELDS.includes(field)) {
    return { ...doc, [field]: parseAmount(input) }
  }
  const trimmed = input.trim()
  return { ...doc, [field]: trimmed === "" ? null : trimmed }
}

/**
 * Nezrovnalosť medzi základom, daňou a celkovou sumou — alebo `null`, keď
 * doklad sedí (či sa nedá posúdiť).
 *
 * Ručná oprava jednej sumy je najčastejší spôsob, ako sa doklad rozsype:
 * používateľ opraví „spolu“ podľa bločka a základ s daňou zostanú staré.
 * Potvrdiť sa to dá aj tak — je to upozornenie, nie zámok.
 */
export function totalsMismatch(doc: ExtractedDocument): string | null {
  const { subtotal, vatTotal, total } = doc
  if (subtotal === null || total === null) return null
  const vat = vatTotal ?? 0
  const diff = Math.abs(subtotal + vat - total)
  // Halier tolerujeme — zaokrúhľovanie na doklade je bežné.
  if (diff <= 0.011) return null
  return "Základ a DPH nedávajú dokopy sumu spolu. Skontroluj ich."
}
