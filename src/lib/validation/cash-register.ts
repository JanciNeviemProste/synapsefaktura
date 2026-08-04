import { z } from "zod"

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

/** Pokladna (cash_registers) — ciselne rady zatial nenapajame. */
export const cashRegisterSchema = z.object({
  name: z.string().trim().min(1, "Zadaj názov pokladne."),
  description: optionalString,
  currency: z.string().trim().default("EUR"),
  active: z.boolean().default(true),
})

export type CashRegisterInput = z.input<typeof cashRegisterSchema>
export type CashRegisterValues = z.output<typeof cashRegisterSchema>

/** Pokladnicny doklad (cash_register_items). */
export const cashItemSchema = z.object({
  cashRegisterId: z.string().uuid("Vyber pokladňu."),
  direction: z.enum(["in", "out"], {
    errorMap: () => ({ message: "Vyber typ dokladu." }),
  }),
  number: optionalString,
  issuedOn: z.string().trim().min(1, "Zadaj dátum."),
  /** Suma dokladu vratane DPH; DB ma check `amount > 0`. */
  amount: z.coerce.number().positive("Suma musí byť väčšia ako nula."),
  vatAmount: z.coerce.number().min(0, "DPH nesmie byť záporná.").default(0),
  description: optionalString,
  contactId: optionalUuid,
  documentId: optionalUuid,
  expenseId: optionalUuid,
})

export type CashItemInput = z.input<typeof cashItemSchema>
export type CashItemValues = z.output<typeof cashItemSchema>

export const CASH_DIRECTION_LABELS: Record<"in" | "out", string> = {
  in: "Príjmový doklad",
  out: "Výdavkový doklad",
}
