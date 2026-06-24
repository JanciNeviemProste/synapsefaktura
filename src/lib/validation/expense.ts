import { z } from "zod"

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

export const expenseSchema = z.object({
  supplierContactId: z.string().uuid().nullable().optional(),
  documentNumber: optionalString,
  issueDate: optionalString,
  supplyDate: optionalString,
  dueDate: optionalString,
  currency: z.string().trim().default("EUR"),
  /** Tax base (entered without VAT); VAT + total are derived server-side. */
  subtotal: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(23),
  category: optionalString,
  taxDeductible: z.boolean().default(true),
  notes: optionalString,
  attachmentUrl: optionalString,
})

export type ExpenseInput = z.input<typeof expenseSchema>
export type ExpenseValues = z.output<typeof expenseSchema>

export const EXPENSE_CATEGORIES = [
  "Materiál",
  "Služby",
  "Nájom",
  "Energie",
  "Softvér / IT",
  "Marketing",
  "Doprava",
  "Kancelária",
  "Ostatné",
] as const
