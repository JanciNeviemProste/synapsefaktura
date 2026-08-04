import { z } from "zod"

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

/**
 * Kontaktna osoba klienta. `contacts` ma len jeden email a telefon, co pri firme
 * s viacerymi ludmi (nakup, uctovnictvo, prevadzka) nestaci.
 * `contactId` nie je sucastou schemy — chodi ako samostatny argument akcie, aby
 * sa klientom nedal prepisat cez formularove data.
 */
export const contactPersonSchema = z.object({
  name: z.string().trim().min(1, "Zadaj meno."),
  position: optionalString,
  email: z
    .string()
    .trim()
    .email("Neplatný e-mail.")
    .optional()
    .or(z.literal("")),
  phone: optionalString,
  isPrimary: z.boolean().default(false),
  note: optionalString,
})

export type ContactPersonInput = z.input<typeof contactPersonSchema>
export type ContactPersonValues = z.output<typeof contactPersonSchema>
