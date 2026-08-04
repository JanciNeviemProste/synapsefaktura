import { z } from "zod"

export const vatModeSchema = z.enum([
  "payer",
  "non_payer",
  "reverse_charge_domestic",
  "intra_eu_b2b",
  "oss",
  "export",
  "exempt",
])

export type VatMode = z.infer<typeof vatModeSchema>

export const VAT_MODE_LABELS: Record<VatMode, string> = {
  payer: "Platiteľ DPH",
  non_payer: "Neplatiteľ DPH",
  reverse_charge_domestic: "Prenesenie daňovej povinnosti (§69)",
  intra_eu_b2b: "Intra-EÚ B2B",
  oss: "OSS",
  export: "Export (mimo EÚ)",
  exempt: "Oslobodené plnenia",
}

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Zadaj názov firmy."),
  legalForm: z.string().trim().optional(),
  ico: z.string().trim().optional(),
  dic: z.string().trim().optional(),
  icDph: z.string().trim().optional(),
  isVatPayer: z.boolean().default(false),
  vatModeDefault: vatModeSchema.default("non_payer"),
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().default("SK"),
  defaultCurrency: z.string().trim().default("EUR"),
  defaultLanguage: z.string().trim().default("sk"),
  defaultDueDays: z.coerce.number().int().min(0).max(365).default(14),
  iban: z.string().trim().optional(),
  swift: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
})

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>
export type CreateOrganizationValues = z.output<typeof createOrganizationSchema>

/**
 * Firemny profil upravovany v nastaveniach. Oproti `createOrganizationSchema`
 * je to plny objekt (formular posiela vsetky polia naraz), takze volitelne
 * textove polia maju default "" — prazdny retazec sa v akcii uklada ako NULL.
 * Banka tu nie je: `organizations` nema stlpce pre IBAN/SWIFT, bankove ucty su
 * vlastna tabulka.
 */
export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Zadaj názov firmy."),
  legalForm: z.string().trim().default(""),
  ico: z.string().trim().default(""),
  dic: z.string().trim().default(""),
  icDph: z.string().trim().default(""),
  isVatPayer: z.boolean().default(false),
  vatModeDefault: vatModeSchema.default("non_payer"),
  street: z.string().trim().default(""),
  city: z.string().trim().default(""),
  postalCode: z.string().trim().default(""),
  country: z.string().trim().min(1, "Zadaj krajinu.").default("SK"),
  defaultCurrency: z.string().trim().min(1, "Zadaj menu.").default("EUR"),
  defaultLanguage: z.string().trim().min(1, "Zadaj jazyk.").default("sk"),
  defaultDueDays: z.coerce
    .number()
    .int("Splatnosť musí byť celé číslo.")
    .min(0, "Splatnosť musí byť 0 až 365 dní.")
    .max(365, "Splatnosť musí byť 0 až 365 dní.")
    .default(14),
})

export type UpdateOrganizationInput = z.input<typeof updateOrganizationSchema>
export type UpdateOrganizationValues = z.output<typeof updateOrganizationSchema>
