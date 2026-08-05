import { z } from "zod"

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))

/** Uctovne clenenie polozky nakladu — rovnake stlpce ako pri dokladoch. */
const accountingField = z.string().trim().optional().or(z.literal(""))

export const expenseItemSchema = z.object({
  description: z.string().trim().default(""),
  accountCode: accountingField,
  costCenter: accountingField,
  projectCode: accountingField,
  activityCode: accountingField,
  quantity: z.coerce.number().finite("Zadaj množstvo ako číslo.").default(1),
  unit: z.string().trim().default("ks"),
  unitPrice: z.coerce
    .number()
    .finite("Zadaj jednotkovú cenu ako číslo.")
    .default(0),
  vatRate: z.coerce
    .number()
    .min(0, "Sadzba DPH nesmie byť záporná.")
    .max(100, "Sadzba DPH môže byť najviac 100 %.")
    .default(23),
})

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
  /**
   * Rozpis položiek. Voliteľný ZÁMERNE — AI OCR z bločku aj prijatá e-faktúra
   * podávajú jednu sumu a jednu sadzbu a majú tak fungovať ďalej. Keď položky
   * prídu, majú prednosť: `subtotal` a `vatRate` sa z nich prepočítajú a
   * hodnoty poslané volajúcim sa zahodia.
   */
  items: z.array(expenseItemSchema).optional(),
})

export type ExpenseItemInput = z.input<typeof expenseItemSchema>

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
