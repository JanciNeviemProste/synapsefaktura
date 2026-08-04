import { z } from "zod"

/**
 * Tankovanie (refuelings). Preco to niekomu zalezi: pri danovej kontrole sa
 * porovnava najazdene km x normovana spotreba oproti REALNE nakupenemu palivu
 * a uznat sa da len to nizsie z dvojice. Bez zapisanych tankovani teda druha
 * strana porovnania chyba a uznatelne palivo sa neda dolozit.
 */

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || z.string().uuid().safeParse(v).success,
    "Neplatná väzba.",
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

/**
 * Celkova suma je volitelna: ked ju pouzivatel nevyplni, akcia ju dopocita ako
 * litre x cena za liter. Nula by naopak tvrdila, ze palivo bolo zadarmo.
 */
const optionalTotal = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ invalid_type_error: "Zadaj celkovú sumu ako číslo." })
    .finite("Zadaj celkovú sumu ako číslo.")
    .min(0, "Celková suma nesmie byť záporná.")
    .optional(),
)

export const refuelingSchema = z.object({
  vehicleId: z.string().uuid("Vyber vozidlo."),
  refueledAt: z.string().trim().min(1, "Zadaj dátum tankovania."),
  /** DB check `refuelings_positive` vyzaduje litre > 0. */
  litres: z.coerce
    .number({ invalid_type_error: "Zadaj počet litrov ako číslo." })
    .finite("Zadaj počet litrov ako číslo.")
    .gt(0, "Počet litrov musí byť väčší ako nula."),
  pricePerLitre: z.coerce
    .number({ invalid_type_error: "Zadaj cenu za liter ako číslo." })
    .finite("Zadaj cenu za liter ako číslo.")
    .min(0, "Cena za liter nesmie byť záporná.")
    .default(0),
  totalPrice: optionalTotal,
  odometerKm: optionalOdometer,
  /** Vazba na doklad o nakupe paliva (volitelna). */
  expenseId: optionalUuid,
})

export type RefuelingInput = z.input<typeof refuelingSchema>
export type RefuelingValues = z.output<typeof refuelingSchema>
