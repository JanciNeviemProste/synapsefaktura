import { z } from "zod"
import { vatModeSchema } from "./org"

export const recurringTemplateItemSchema = z.object({
  description: z.string().trim().default(""),
  quantity: z.coerce.number().default(1),
  unit: z.string().trim().default("ks"),
  unitPrice: z.coerce.number().default(0),
  vatRate: z.coerce.number().min(0).max(100).default(23),
  discountPct: z.coerce.number().min(0).max(100).default(0),
})

export const recurringTemplateSchema = z.object({
  vatMode: vatModeSchema.default("payer"),
  currency: z.string().trim().default("EUR"),
  language: z.string().trim().default("sk"),
  dueDays: z.coerce.number().int().min(0).max(365).default(14),
  notes: z.string().trim().optional().or(z.literal("")),
  items: z
    .array(recurringTemplateItemSchema)
    .min(1, "Pridaj aspoň jednu položku."),
})

export const recurringSchema = z.object({
  name: z.string().trim().min(1, "Zadaj názov."),
  contactId: z.string().uuid().nullable().optional(),
  cadence: z.enum(["weekly", "monthly", "custom"]).default("monthly"),
  intervalDays: z.coerce.number().int().min(1).max(365).optional(),
  nextRunAt: z.string().min(1, "Zadaj dátum najbližšieho vystavenia."),
  active: z.boolean().default(true),
  template: recurringTemplateSchema,
})

export type RecurringTemplate = z.output<typeof recurringTemplateSchema>
export type RecurringInput = z.input<typeof recurringSchema>
export type RecurringValues = z.output<typeof recurringSchema>

export const CADENCE_LABELS = {
  weekly: "Týždenne",
  monthly: "Mesačne",
  custom: "Vlastný interval",
} as const
