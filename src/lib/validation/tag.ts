import { z } from "zod"

/**
 * Stitky (tags) — nazov + volitelna farba.
 *
 * Farbu ukladame VZDY ako hex `#rrggbb` malymi pismenami, aby sa dala priamo
 * vlozit do `style` a aby v DB nevznikli dva zapisy tej istej farby (`#ABC`
 * vs `#aabbcc`). Nazov je jedinecny v ramci organizacie (unique v migracii).
 */

/** Ponuka farieb v UI. Hodnoty su ulozene, nie len zobrazene. */
export const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const

/** Typy entit, ktore sa daju stitkovat — zhodne s enumom `taggable_type`. */
export const TAGGABLE_TYPES = ["document", "expense", "contact"] as const

export type TaggableType = (typeof TAGGABLE_TYPES)[number]

export const taggableTypeSchema = z.enum(TAGGABLE_TYPES)

/** Popisky typov pre pouzivatelske texty. */
export const TAGGABLE_LABELS: Record<TaggableType, string> = {
  document: "doklad",
  expense: "náklad",
  contact: "klient",
}

/**
 * Zjednoti zapis farby: doplni `#`, rozvinie skrateny tvar (#abc → #aabbcc)
 * a zmensi pismena. Prazdny vstup vrati `undefined` (stitok bez farby).
 */
export function normalizeColor(
  raw: string | null | undefined,
): string | undefined {
  const value = (raw ?? "").trim().toLowerCase()
  if (value === "") return undefined
  const hex = value.startsWith("#") ? value.slice(1) : value
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
  }
  return `#${hex}`
}

/** Platna je len normalizovana forma `#rrggbb`. */
export function isValidColor(raw: string | null | undefined): boolean {
  return /^#[0-9a-f]{6}$/.test((raw ?? "").trim().toLowerCase())
}

/**
 * Farba textu na farebnom stitku. Bez toho by zlty stitok s bielym pismom
 * nebol citatelny. Relativna svetlost podla WCAG (sRGB linearizacia); prah
 * 0.179 je bod, kde ma biele a tmave pismo rovnaky kontrastny pomer.
 */
export function contrastText(color: string | null | undefined): string {
  const hex = normalizeColor(color)
  if (!hex || !isValidColor(hex)) return "#ffffff"

  const channel = (from: number) => {
    const c = parseInt(hex.slice(from, from + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return luminance > 0.179 ? "#111827" : "#ffffff"
}

export const tagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Zadaj názov štítku.")
    .max(40, "Názov štítku môže mať najviac 40 znakov."),
  color: z
    .string()
    .trim()
    .optional()
    .transform(normalizeColor)
    .refine(
      (v) => v === undefined || isValidColor(v),
      "Farba musí byť hex kód (napr. #3b82f6).",
    ),
})

export const taggingSchema = z.object({
  tagId: z.string().uuid("Neplatný štítok."),
  taggableType: taggableTypeSchema,
  taggableId: z.string().uuid("Neplatná entita."),
})

export type TagInput = z.input<typeof tagSchema>
export type TagValues = z.output<typeof tagSchema>
export type TaggingInput = z.input<typeof taggingSchema>
