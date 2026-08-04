import { z } from "zod"

/**
 * Udalost vozidla (vehicle_events) — servis, STK, poistka, oprava, prezutie,
 * pokuta. `nextDueOn` je pripomienka dalsieho terminu: STK a poistka sa
 * opakuju a zmeskany termin je drahsi nez samotna udalost.
 */

/** Prazdne pole formulara je "nevyplnene", nie prazdny retazec. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

const optionalDate = optionalString.refine(
  (v) => v === undefined || !Number.isNaN(Date.parse(v)),
  "Neplatný dátum.",
)

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || z.string().uuid().safeParse(v).success,
    "Neplatná väzba.",
  )

/** Prazdny naklad je "nevyplneny", nie nula (nula = udalost bola zadarmo). */
const optionalCost = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ invalid_type_error: "Zadaj náklad ako číslo." })
    .finite("Zadaj náklad ako číslo.")
    .min(0, "Náklad nesmie byť záporný.")
    .optional(),
)

/** Prazdny stav tachometra je "nevyplneny", nie nula. */
const optionalOdometer = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ invalid_type_error: "Zadaj stav tachometra ako číslo." })
    .finite("Zadaj stav tachometra ako číslo.")
    .min(0, "Stav tachometra nesmie byť záporný.")
    .optional(),
)

export const VEHICLE_EVENT_TYPES = [
  "service",
  "inspection",
  "insurance",
  "repair",
  "tyres",
  "fine",
  "other",
] as const
export type VehicleEventType = (typeof VEHICLE_EVENT_TYPES)[number]

export const VEHICLE_EVENT_TYPE_LABELS: Record<VehicleEventType, string> = {
  service: "Servis",
  inspection: "STK / EK",
  insurance: "Poistenie",
  repair: "Oprava",
  tyres: "Prezutie",
  fine: "Pokuta",
  other: "Iné",
}

export const vehicleEventSchema = z.object({
  vehicleId: z.string().uuid("Vyber vozidlo."),
  type: z
    .enum(VEHICLE_EVENT_TYPES, {
      required_error: "Vyber typ udalosti.",
      invalid_type_error: "Vyber typ udalosti.",
    })
    .default("other"),
  eventDate: z.string().trim().min(1, "Zadaj dátum udalosti."),
  description: optionalString,
  cost: optionalCost,
  odometerKm: optionalOdometer,
  /** Vazba na doklad o nakupe sluzby (volitelna). */
  expenseId: optionalUuid,
  /** Pripomienka dalsieho terminu — napr. dalsia STK. */
  nextDueOn: optionalDate,
})

export type VehicleEventInput = z.input<typeof vehicleEventSchema>
export type VehicleEventValues = z.output<typeof vehicleEventSchema>
