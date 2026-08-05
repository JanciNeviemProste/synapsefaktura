import { z } from "zod"
import { TRIP_PURPOSES } from "@/lib/validation/trip"

/**
 * Šablóna pravidelnej jazdy — dochádzka na prevádzku, pravidelný rozvoz,
 * týždenná návšteva klienta.
 *
 * Zámerne NEOBSAHUJE stav tachometra: šablóna nevie, aký bude v deň jazdy.
 * Vygenerovaná jazda ho preto má prázdny a používateľ ho doplní, ak ho vedie.
 */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || z.string().uuid().safeParse(v).success,
    "Neplatná väzba.",
  )

export const recurringTripSchema = z
  .object({
    vehicleId: z.string().uuid("Vyber vozidlo."),
    cadence: z.enum(["weekly", "monthly", "custom"]).default("monthly"),
    /** Použije sa len pri `custom`. */
    intervalDays: z.coerce
      .number()
      .int()
      .min(1, "Interval musí byť aspoň 1 deň.")
      .max(365, "Interval môže byť najviac 365 dní.")
      .optional(),
    origin: optionalString,
    destination: optionalString,
    contactId: optionalUuid,
    distanceKm: z.coerce
      .number({ invalid_type_error: "Zadaj dĺžku jazdy ako číslo." })
      .finite("Zadaj dĺžku jazdy ako číslo.")
      .min(0, "Dĺžka jazdy nesmie byť záporná.")
      .default(0),
    roundTrip: z.boolean().default(true),
    withTrailer: z.boolean().default(false),
    purpose: z.enum(TRIP_PURPOSES).default("business"),
    purposeNote: optionalString,
    nextRunOn: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Zadaj dátum v tvare RRRR-MM-DD."),
    active: z.boolean().default(true),
  })
  .refine((v) => v.cadence !== "custom" || v.intervalDays !== undefined, {
    path: ["intervalDays"],
    message: "Pri vlastnom intervale zadaj počet dní.",
  })

export type RecurringTripInput = z.input<typeof recurringTripSchema>
export type RecurringTripValues = z.output<typeof recurringTripSchema>

export const TRIP_CADENCE_LABELS = {
  weekly: "Týždenne",
  monthly: "Mesačne",
  custom: "Vlastný interval",
} as const
