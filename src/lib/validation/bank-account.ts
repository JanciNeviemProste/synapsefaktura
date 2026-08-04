import { z } from "zod"

/**
 * Bankovy ucet organizacie — normalizacia a validacia IBAN/BIC.
 *
 * IBAN (ISO 13616) ukladame VZDY bez medzier a velkymi pismenami, lebo z neho
 * stavame PAY by square QR a UBL PaymentMeans. Kontrolujeme tvar, dlzku podla
 * krajiny (ak ju pozname) a mod-97 kontrolnu cislicu — preklep tak neprejde na
 * faktury.
 */

/** Dlzky IBAN pre krajiny, do ktorych sa realne fakturuje z SK. */
const IBAN_LENGTHS: Record<string, number> = {
  AT: 20,
  BE: 16,
  CH: 21,
  CZ: 24,
  DE: 22,
  DK: 18,
  ES: 24,
  FI: 18,
  FR: 27,
  GB: 22,
  HR: 21,
  HU: 28,
  IE: 22,
  IT: 27,
  NL: 18,
  PL: 28,
  PT: 25,
  RO: 24,
  SE: 24,
  SI: 19,
  SK: 24,
}

/** Odstrani medzery aj pomlcky a zjednoti na velke pismena. */
export function normalizeIban(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s -]/g, "").toUpperCase()
}

/** Zobrazovaci tvar po styroch znakoch (SK89 7500 0000 ...). */
export function formatIban(raw: string | null | undefined): string {
  const iban = normalizeIban(raw)
  return iban.replace(/(.{4})/g, "$1 ").trim()
}

/**
 * Mod-97 podla ISO 7064: prve 4 znaky na koniec, pismena na cisla (A=10..Z=35)
 * a postupne zvysky, aby sa nepracovalo s velkym cislom.
 */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0)
    const value = code >= 65 ? code - 55 : code - 48
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97
  }
  return remainder
}

/** Zakladna validacia IBAN: tvar + dlzka krajiny + kontrolna cislica. */
export function isValidIban(raw: string | null | undefined): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const expected = IBAN_LENGTHS[iban.slice(0, 2)]
  if (expected && iban.length !== expected) return false
  return mod97(iban) === 1
}

/** SWIFT/BIC bez medzier, velkymi pismenami. */
export function normalizeSwift(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s -]/g, "").toUpperCase()
}

/** BIC ma 8 (banka+krajina+lokalita) alebo 11 znakov (+ pobocka). */
export function isValidSwift(raw: string | null | undefined): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeSwift(raw))
}

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

export const bankAccountSchema = z.object({
  iban: z
    .string()
    .trim()
    .min(1, "Zadaj IBAN.")
    .transform(normalizeIban)
    .refine(
      isValidIban,
      "IBAN nemá platný tvar (napr. SK89 7500 0000 0000 1234 5671).",
    ),
  swift: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      const swift = normalizeSwift(v)
      return swift === "" ? undefined : swift
    })
    .refine(
      (v) => v === undefined || isValidSwift(v),
      "SWIFT/BIC má 8 alebo 11 znakov (napr. TATRSKBX).",
    ),
  bankName: optionalString,
  currency: z
    .string()
    .trim()
    .default("EUR")
    .transform((v) => v.toUpperCase())
    .refine(
      (v) => /^[A-Z]{3}$/.test(v),
      "Mena musí byť 3-písmenový kód (napr. EUR).",
    ),
  isDefault: z.boolean().default(false),
})

export type BankAccountInput = z.input<typeof bankAccountSchema>
export type BankAccountValues = z.output<typeof bankAccountSchema>
