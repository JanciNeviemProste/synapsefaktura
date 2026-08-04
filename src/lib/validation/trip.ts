import { z } from "zod"

/**
 * Jazda (trips). Kniha jazd je danovy podklad, takze plati:
 * - SUKROMNA jazda sa do danovo uznatelnych nakladov NEZAPOCITAVA (je tu len
 *   preto, aby sedel stav tachometra),
 * - konecny stav tachometra nesmie byt nizsi nez zaciatocny — rovnaku podmienku
 *   ma aj DB check `trips_odometer_order`; tu ju kontrolujeme znova, aby
 *   pouzivatel dostal citatelnu hlasku a nie chybu constraintu.
 */

/** Prazdne pole formulara je "nevyplnene", nie prazdny retazec. */
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

/**
 * Prazdny stav tachometra je "nevyplneny", nie nula. Nula by tvrdila, ze auto
 * ma najazdenych 0 km, a rozbila by kontrolu poradia stavov.
 */
const optionalOdometer = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ invalid_type_error: "Zadaj stav tachometra ako číslo." })
    .finite("Zadaj stav tachometra ako číslo.")
    .min(0, "Stav tachometra nesmie byť záporný.")
    .optional(),
)

export const TRIP_PURPOSES = ["business", "private"] as const
export type TripPurpose = (typeof TRIP_PURPOSES)[number]

export const TRIP_PURPOSE_LABELS: Record<TripPurpose, string> = {
  business: "Služobná",
  private: "Súkromná",
}

/**
 * Hlaska pre poradie stavov tachometra. Drzime ju na jednom mieste, lebo ju
 * pouziva zodova kontrola aj zachytenie DB checku `trips_odometer_order`.
 */
export const ODOMETER_ORDER_MESSAGE =
  "Konečný stav tachometra nesmie byť nižší než začiatočný."

export const tripSchema = z
  .object({
    vehicleId: z.string().uuid("Vyber vozidlo."),
    tripDate: z.string().trim().min(1, "Zadaj dátum jazdy."),
    /** Odkial. */
    origin: optionalString,
    /** Kam. */
    destination: optionalString,
    /** Klient, ku ktoremu sa jazda viaze (volitelne). */
    contactId: optionalUuid,
    distanceKm: z.coerce
      .number({ invalid_type_error: "Zadaj dĺžku jazdy ako číslo." })
      .finite("Zadaj dĺžku jazdy ako číslo.")
      .min(0, "Dĺžka jazdy nesmie byť záporná.")
      .default(0),
    /** Tam aj spat. */
    roundTrip: z.boolean().default(true),
    purpose: z
      .enum(TRIP_PURPOSES, {
        required_error: "Vyber typ jazdy.",
        invalid_type_error: "Vyber typ jazdy.",
      })
      .default("business"),
    /** Ucel jazdy slovom — pri kontrole je to to, co sa cita. */
    purposeNote: optionalString,
    driverName: optionalString,
    odometerStartKm: optionalOdometer,
    odometerEndKm: optionalOdometer,
  })
  .superRefine((v, ctx) => {
    if (
      v.odometerStartKm !== undefined &&
      v.odometerEndKm !== undefined &&
      v.odometerEndKm < v.odometerStartKm
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["odometerEndKm"],
        message: ODOMETER_ORDER_MESSAGE,
      })
    }
  })

export type TripInput = z.input<typeof tripSchema>
export type TripValues = z.output<typeof tripSchema>
