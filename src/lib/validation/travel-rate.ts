import { z } from "zod"

/**
 * Sadzba cestovnej náhrady s platnosťou od-do.
 *
 * `validTo` je voliteľné — prázdne znamená „platí doteraz". Preto sa tu
 * nekontroluje len tvar, ale aj to, že koniec nie je pred začiatkom: DB má
 * rovnaké `check`, ale používateľ si zaslúži hlášku, nie chybu z databázy.
 */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Zadaj dátum v tvare RRRR-MM-DD.")

/**
 * Sadzba z textového poľa. Prázdne pole posiela volajúci ako `NaN` — bez
 * kontroly na konečnosť by `nonnegative()` odmietlo `NaN` hláškou „Sadzba
 * nesmie byť záporná", čo je pri prázdnom poli mätúce.
 */
const rateNumber = z.coerce
  .number()
  .refine(Number.isFinite, "Zadaj sadzbu za km.")
  .refine((v) => v >= 0, "Sadzba nesmie byť záporná.")
  .refine((v) => v <= 100, "Sadzba za km vyzerá nezmyselne vysoká.")

export const travelRateSchema = z
  .object({
    validFrom: isoDate,
    validTo: isoDate.optional().or(z.literal("")),
    ratePerKm: rateNumber,
    fuelRatePerKm: rateNumber.nullable().optional(),
    currency: z.string().trim().default("EUR"),
    /**
     * Prazdne = sadzba plati pre akekolvek vozidlo. Tak sa zvycajne zadava
     * vlastna sadzba firmy; zakonne sadzby kategoriu vyplnenu maju, lebo
     * zakon medzi osobnym autom a motocyklom rozlisuje.
     */
    vehicleCategory: z
      .enum(["passenger", "motorcycle"])
      .nullable()
      .optional(),
    note: z.string().trim().optional().or(z.literal("")),
  })
  .refine((v) => !v.validTo || v.validTo >= v.validFrom, {
    path: ["validTo"],
    message: "Koniec platnosti nesmie byť pred jej začiatkom.",
  })

export type TravelRateInput = z.input<typeof travelRateSchema>
export type TravelRateValues = z.output<typeof travelRateSchema>
