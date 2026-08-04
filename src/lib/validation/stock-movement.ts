import { z } from "zod"

import { STOCK_MOVEMENT_TYPES } from "@/lib/stock/balance"

/**
 * Skladovy pohyb. `quantity` je VZDY kladne — smer urcuje `type` (rovnako ako
 * check `quantity > 0` v migracii). Zaporne mnozstvo by znamenalo dva zdroje
 * smeru a nikto by nevedel, ktory plati.
 */

/** Prazdne pole formulara je "nevyplnene", nie prazdny retazec. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

/** Prazdne cislo z formulara je "nevyplnene", nie nula. */
const optionalUnitCost = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ invalid_type_error: "Zadaj obstarávaciu cenu." })
    .finite("Zadaj obstarávaciu cenu.")
    .min(0, "Obstarávacia cena nesmie byť záporná.")
    .optional(),
)

export const stockMovementSchema = z.object({
  productId: z.string().uuid("Neplatná položka."),
  type: z.enum(STOCK_MOVEMENT_TYPES, {
    required_error: "Vyber typ pohybu.",
    invalid_type_error: "Vyber typ pohybu.",
  }),
  quantity: z.coerce
    .number({ invalid_type_error: "Zadaj množstvo." })
    .finite("Zadaj množstvo.")
    .gt(0, "Množstvo musí byť väčšie ako nula."),
  unitCost: optionalUnitCost,
  /** Datum pohybu; prazdne = teraz. */
  movedAt: optionalString.refine(
    (v) => v === undefined || !Number.isNaN(Date.parse(v)),
    "Neplatný dátum.",
  ),
  note: optionalString,
})

export type StockMovementInput = z.input<typeof stockMovementSchema>
export type StockMovementValues = z.output<typeof stockMovementSchema>
