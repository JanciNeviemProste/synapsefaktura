import { z } from "zod"

/**
 * Uhrada nakladu. Datum uhrady sa zatial neuklada — tabulka `expenses` nema
 * stlpec na datum platby ani vlastnu tabulku uhrad (`payments` visi na
 * `documents`). Az pribudne migracia, doplni sa sem `paidAt`.
 */
export const expensePaymentSchema = z.object({
  expenseId: z.string().uuid("Neplatný náklad."),
  amount: z.coerce
    .number({ invalid_type_error: "Zadaj sumu úhrady." })
    .finite("Zadaj sumu úhrady.")
    .gt(0, "Suma úhrady musí byť väčšia ako nula."),
})

export type ExpensePaymentInput = z.input<typeof expensePaymentSchema>
export type ExpensePaymentValues = z.output<typeof expensePaymentSchema>
