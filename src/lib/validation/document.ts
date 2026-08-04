import { z } from "zod"
import { vatModeSchema } from "./org"

export const documentTypeSchema = z.enum([
  "invoice",
  "proforma",
  "advance",
  "tax_doc_payment",
  "credit_note",
  "quote",
  "order_issued",
  "order_received",
  "delivery_note",
  "draft",
])

export const documentItemSchema = z.object({
  description: z.string().trim().default(""),
  quantity: z.coerce.number().default(1),
  unit: z.string().trim().default("ks"),
  unitPrice: z.coerce.number().default(0),
  vatRate: z.coerce.number().min(0).max(100).default(23),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  productId: z.string().uuid().nullable().optional(),
})

export const documentSchema = z.object({
  type: documentTypeSchema.default("invoice"),
  contactId: z.string().uuid().nullable().optional(),
  issueDate: z.string().min(1, "Zadaj dátum vystavenia."),
  supplyDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  currency: z.string().trim().default("EUR"),
  exchangeRate: z.coerce.number().positive().default(1),
  language: z.string().trim().default("sk"),
  vatMode: vatModeSchema.default("payer"),
  notes: z.string().trim().optional().or(z.literal("")),
  footerNotes: z.string().trim().optional().or(z.literal("")),
  /**
   * Prepinac cien NAD typom dokladu. `undefined` znamena "rozhodne typ" —
   * preto tu nie je `.default()`: default by z kazdeho ulozenia spravil
   * vyslovne rozhodnutie a dodaci list by sa uz nikdy nevratil k svojmu
   * prirodzenemu spravaniu.
   */
  showPrices: z.boolean().nullable().optional(),
  /**
   * Účtovné členenie. V schéme sedí na položke (`document_items`), pretože
   * jeden doklad môže niesť riadky z rôznych stredísk. Formulár ho zatiaľ
   * vystavuje na úrovni dokladu a zapíše na všetky položky — tak to malé firmy
   * v praxi používajú. Rozlíšenie po položkách je tým pádom pripravené, len
   * zatiaľ neponúknuté.
   */
  accountCode: z.string().trim().optional().or(z.literal("")),
  costCenter: z.string().trim().optional().or(z.literal("")),
  projectCode: z.string().trim().optional().or(z.literal("")),
  activityCode: z.string().trim().optional().or(z.literal("")),
  // Vazba na zdrojovy doklad (prevod, dobropis). Ked chyba, zapis sa jej
  // nedotkne — existujuca vazba tak prezije bezne ulozenie z editora.
  relatedDocumentId: z.string().uuid().nullable().optional(),
  items: z.array(documentItemSchema).min(1, "Pridaj aspoň jednu položku."),
})

export type DocumentItemInput = z.input<typeof documentItemSchema>
export type DocumentInput = z.input<typeof documentSchema>
export type DocumentValues = z.output<typeof documentSchema>
