import { z } from "zod"

/** Prazdne pole formulara je "nevyplnene", nie prazdny retazec. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

/**
 * Kombinovana spotreba je danovy podklad — prazdne pole musi zostat
 * "nevyplnene". Nula by tvrdila, ze vozidlo nespotrebuje nic, a teda ze
 * uznatelne nie je ziadne palivo.
 */
const optionalConsumption = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ invalid_type_error: "Zadaj spotrebu ako číslo." })
    .finite("Zadaj spotrebu ako číslo.")
    .min(0, "Spotreba nesmie byť záporná.")
    .optional(),
)

export const FUEL_TYPES = [
  "petrol",
  "diesel",
  "lpg",
  "cng",
  "electric",
  "hybrid",
] as const
export type FuelType = (typeof FUEL_TYPES)[number]

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  petrol: "Benzín",
  diesel: "Nafta",
  lpg: "LPG",
  cng: "CNG",
  electric: "Elektrina",
  hybrid: "Hybrid",
}

export const VEHICLE_OWNERSHIPS = ["company", "private", "leased"] as const
export type VehicleOwnership = (typeof VEHICLE_OWNERSHIPS)[number]

export const VEHICLE_OWNERSHIP_LABELS: Record<VehicleOwnership, string> = {
  company: "Firemné",
  private: "Súkromné",
  leased: "Prenajaté / leasing",
}

/**
 * Vozidlo (vehicles). ECV drzime velkymi pismenami bez medzier — v DB je
 * unikatny index `(organization_id, license_plate)` a "BA123AB" vs "ba 123 ab"
 * je to iste auto, ktore by inak preslo dvakrat.
 */
export const vehicleSchema = z.object({
  name: z.string().trim().min(1, "Zadaj názov vozidla."),
  licensePlate: z
    .string()
    .trim()
    .min(1, "Zadaj ECV.")
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  fuelType: z
    .enum(FUEL_TYPES, {
      required_error: "Vyber palivo.",
      invalid_type_error: "Vyber palivo.",
    })
    .default("petrol"),
  ownership: z
    .enum(VEHICLE_OWNERSHIPS, {
      required_error: "Vyber vlastníctvo.",
      invalid_type_error: "Vyber vlastníctvo.",
    })
    .default("company"),
  driverName: optionalString,
  /** Kombinovana spotreba v l/100 km podla technickeho preukazu. */
  consumptionL100Km: optionalConsumption,
  /** Aktualny stav tachometra. */
  odometerKm: z.coerce
    .number({ invalid_type_error: "Zadaj stav tachometra ako číslo." })
    .finite("Zadaj stav tachometra ako číslo.")
    .min(0, "Stav tachometra nesmie byť záporný.")
    .default(0),
  vin: optionalString,
  note: optionalString,
  active: z.boolean().default(true),
})

export type VehicleInput = z.input<typeof vehicleSchema>
export type VehicleValues = z.output<typeof vehicleSchema>
