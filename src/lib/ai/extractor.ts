import "server-only"

import { z } from "zod"
import type { ModelMessage } from "ai"
import { generateStructured, type AiResult } from "./generate"

/**
 * Structured shape extracted from a supplier invoice / receipt (§7.1).
 * Everything is nullable — bad scans degrade to nulls + a low confidence rather
 * than fabricated data (§7 guardrail: never fabricate figures).
 */
export const extractedDocumentSchema = z.object({
  supplierName: z.string().nullable(),
  supplierIco: z.string().nullable(),
  supplierIcDph: z.string().nullable(),
  documentNumber: z.string().nullable(),
  issueDate: z.string().nullable(), // YYYY-MM-DD
  supplyDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  currency: z.string().nullable(),
  iban: z.string().nullable(),
  variableSymbol: z.string().nullable(),
  subtotal: z.number().nullable(),
  vatTotal: z.number().nullable(),
  total: z.number().nullable(),
  vatRate: z.number().nullable(),
  lines: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().nullable(),
        unitPrice: z.number().nullable(),
        vatRate: z.number().nullable(),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1).default(0.5),
})

export type ExtractedDocument = z.infer<typeof extractedDocumentSchema>

export interface DocumentFile {
  data: Uint8Array
  mediaType: string // e.g. application/pdf, image/jpeg
}

export interface DocumentExtractor {
  extract(file: DocumentFile): Promise<AiResult<ExtractedDocument>>
}

const SYSTEM = `Si expert na vyťaženie údajov zo slovenských a českých účtovných dokladov (faktúry, bločky, pokladničné doklady). Z priloženého dokladu vyťaž štruktúrované údaje dodávateľa a hlavičky.
Pravidlá:
- Dátumy vo formáte YYYY-MM-DD.
- Sumy ako čísla s bodkou ako desatinným oddeľovačom (napr. 123.45), bez meny v hodnote.
- IČO/IČ DPH/IBAN/variabilný symbol presne ako na doklade.
- Ak údaj na doklade nie je, použi null. Nič si nevymýšľaj.
- confidence: 0..1 podľa kvality a čitateľnosti skenu.`

/** Gemini-vision extractor. The DocumentExtractor interface keeps it swappable. */
export class GeminiExtractor implements DocumentExtractor {
  async extract(file: DocumentFile): Promise<AiResult<ExtractedDocument>> {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Vyťaž štruktúrované údaje z tohto dokladu." },
          { type: "file", data: file.data, mediaType: file.mediaType },
        ],
      },
    ]
    return generateStructured({
      feature: "capture",
      schema: extractedDocumentSchema,
      system: SYSTEM,
      messages,
    })
  }
}

export const documentExtractor: DocumentExtractor = new GeminiExtractor()
