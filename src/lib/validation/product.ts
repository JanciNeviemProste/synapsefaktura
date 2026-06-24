import { z } from "zod"

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

export const productSchema = z.object({
  name: z.string().trim().min(1, "Zadaj názov položky."),
  sku: optionalString,
  unit: z.string().trim().default("ks"),
  unitPrice: z.coerce.number().min(0, "Cena nesmie byť záporná.").default(0),
  vatRate: z.coerce.number().min(0).max(100).default(23),
  currency: z.string().trim().default("EUR"),
  stockQty: z.coerce.number().optional(),
})

export type ProductInput = z.input<typeof productSchema>
export type ProductValues = z.output<typeof productSchema>
