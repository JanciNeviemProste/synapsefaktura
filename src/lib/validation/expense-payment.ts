import { z } from "zod"

/**
 * Úhrada nákladu.
 *
 * Každá úhrada je vlastný riadok v `expense_payments`; `expenses.paid_amount`
 * je ich súčet. Preto tu pribudli dátum a metóda — bez nich by sa pri kontrole
 * nedalo doložiť, kedy a čím bol náklad uhradený, a opakovaný import výpisu by
 * nemal podľa čoho rozpoznať už zaúčtovanú platbu.
 */

export const PAYMENT_METHODS = ["bank", "card", "cash", "other"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank: "Prevodom",
  card: "Kartou",
  cash: "V hotovosti",
  other: "Iné",
}

export const expensePaymentSchema = z.object({
  expenseId: z.string().uuid("Neplatný náklad."),
  amount: z.coerce
    .number({ invalid_type_error: "Zadaj sumu úhrady." })
    .finite("Zadaj sumu úhrady.")
    .gt(0, "Suma úhrady musí byť väčšia ako nula."),
  /** Prázdne = dnes. */
  paidAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Zadaj dátum v tvare RRRR-MM-DD.")
    .optional()
    .or(z.literal("")),
  method: z.enum(PAYMENT_METHODS).default("bank"),
  note: z.string().trim().optional().or(z.literal("")),
  /**
   * Bankový pohyb, z ktorého úhrada vznikla. Je to kľúč idempotencie: ten istý
   * pohyb sa na ten istý náklad nezaúčtuje dvakrát (unikátny index v DB).
   */
  bankTransactionId: z.string().uuid().nullable().optional(),
})

export type ExpensePaymentInput = z.input<typeof expensePaymentSchema>
export type ExpensePaymentValues = z.output<typeof expensePaymentSchema>
