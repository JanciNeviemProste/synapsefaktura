import { z } from "zod"

export const contactTypeSchema = z.enum(["customer", "supplier", "both"])
export type ContactType = z.infer<typeof contactTypeSchema>

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  customer: "Odberateľ",
  supplier: "Dodávateľ",
  both: "Oboje",
}

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

export const contactSchema = z.object({
  type: contactTypeSchema.default("customer"),
  name: z.string().trim().min(1, "Zadaj názov / meno."),
  ico: optionalString,
  dic: optionalString,
  icDph: optionalString,
  street: optionalString,
  city: optionalString,
  postalCode: optionalString,
  country: z.string().trim().default("SK"),
  email: z
    .string()
    .trim()
    .email("Neplatný e-mail.")
    .optional()
    .or(z.literal("")),
  phone: optionalString,
  defaultDueDays: z.coerce.number().int().min(0).max(365).optional(),
  notes: optionalString,
})

export type ContactInput = z.input<typeof contactSchema>
export type ContactValues = z.output<typeof contactSchema>
