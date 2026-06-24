import { z } from "zod"
import { vatModeSchema } from "./org"

/**
 * Structured output the AI must return when drafting an invoice from a single
 * Slovak sentence (§7.2). Dates are ISO strings (YYYY-MM-DD) or null when the
 * user did not mention them — the action fills sensible defaults.
 */
export const nlInvoiceItemSchema = z.object({
  description: z.string().trim().default(""),
  quantity: z.coerce.number().default(1),
  unit: z.string().trim().default("ks"),
  unitPrice: z.coerce.number().default(0),
  vatRate: z.coerce.number().min(0).max(100).default(23),
})

export const nlInvoiceDraftSchema = z.object({
  contactName: z.string().trim().nullable().default(null),
  issueDate: z.string().trim().nullable().default(null),
  dueDate: z.string().trim().nullable().default(null),
  vatMode: vatModeSchema.default("payer"),
  currency: z.string().trim().default("EUR"),
  items: z.array(nlInvoiceItemSchema).default([]),
})

export type NlInvoiceDraft = z.infer<typeof nlInvoiceDraftSchema>
export type NlInvoiceItem = z.infer<typeof nlInvoiceItemSchema>
