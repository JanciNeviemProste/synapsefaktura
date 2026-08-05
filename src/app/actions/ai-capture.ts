"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ATTACHMENTS_BUCKET } from "@/lib/storage/buckets"
import { checkDocumentFormat } from "@/lib/ai/document-format"
import { deriveVatRate } from "@/lib/expenses/vat-rate"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { documentExtractor, type ExtractedDocument } from "@/lib/ai/extractor"
import { checkAiRateLimit } from "@/lib/ai/rate-limit"
import type { AiFailureReason } from "@/lib/ai/generate"
import type { PlanTier } from "@/lib/billing/plans"
import { createExpense, type ExpenseActionResult } from "@/app/actions/expenses"
import type { Json } from "@/lib/supabase/database.types"

export type ExtractCaptureResult =
  | {
      ok: true
      extractionId: string | null
      parsed: ExtractedDocument
      matchedContactId: string | null
    }
  | {
      ok: false
      degraded: boolean
      error: string
      /** Prítomné, keď zlyhanie rieši upgrade tarifu — UI otvorí UpgradeDialog. */
      upgrade?: PlanTier
      reason?: AiFailureReason
    }

/**
 * §7.1 — AI Document Capture. Reads an uploaded supplier doc, runs the
 * extractor, persists an `ai_extractions` row and tries to match the supplier
 * to an existing contact by IČO. Never auto-creates an expense (human-in-loop).
 */
export async function extractFromStoredFile(
  path: string,
): Promise<ExtractCaptureResult> {
  // Organizáciu zisťujeme PRED volaním modelu — inak by sa spálil token aj
  // vtedy, keď používateľ firmu nemá a výsledok sa aj tak zahodí.
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { ok: false, degraded: false, error: "Chýba firma." }
  }

  // Prefix organizácie bráni siahnuť na cudzí súbor — cestu posiela klient.
  if (!path.startsWith(`${orgId}/`)) {
    return { ok: false, degraded: false, error: "Súbor sa nenašiel." }
  }

  const limited = await checkAiRateLimit(supabase, orgId, "capture")
  if (!limited.ok) {
    return { ok: false, degraded: false, error: limited.error }
  }

  // Súbor je už v úložisku — prehliadač ho tam poslal priamo. Doteraz cestoval
  // po drôte DVAKRÁT (raz na uloženie, raz na vyťaženie) a pri fotke z mobilu
  // na dátach to bol dvojnásobný upload.
  const { data: blob, error: downloadError } = await createAdminClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .download(path)
  if (downloadError || !blob) {
    return { ok: false, degraded: false, error: "Súbor sa nenašiel." }
  }
  const data = new Uint8Array(await blob.arrayBuffer())

  // Formát sa určuje z OBSAHU, nie z toho, čo nahlásil prehliadač. Prázdny
  // `file.type` sa doteraz poslal modelu ako `application/octet-stream`,
  // model vrátil 400 a používateľ videl len „AI volanie zlyhalo."
  const format = checkDocumentFormat(data)
  if (!format.ok) {
    return { ok: false, degraded: false, error: format.error }
  }

  const result = await documentExtractor.extract({
    data,
    mediaType: format.mime,
  })
  if (!result.ok) {
    return {
      ok: false,
      degraded: result.degraded,
      error: result.error,
      reason: result.reason,
      ...(result.upgrade ? { upgrade: result.upgrade } : {}),
    }
  }
  const parsed = result.data

  // Match supplier to an existing contact by IČO (supplier / both).
  let matchedContactId: string | null = null
  const ico = parsed.supplierIco?.trim()
  if (ico) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("ico", ico)
      .in("type", ["supplier", "both"])
      .limit(1)
      .maybeSingle()
    matchedContactId = contact?.id ?? null
  }

  // Persist the extraction (best-effort — capture still works without the row).
  let extractionId: string | null = null
  const { data: row } = await supabase
    .from("ai_extractions")
    .insert({
      organization_id: orgId,
      parsed: parsed as unknown as Json,
      raw_response: parsed as unknown as Json,
      confidence: parsed.confidence,
      status: "parsed",
    })
    .select("id")
    .single()
  extractionId = row?.id ?? null

  return { ok: true, extractionId, parsed, matchedContactId }
}

export type ConfirmCaptureInput = {
  extractionId?: string | null
  parsed: ExtractedDocument
  supplierContactId?: string | null
  attachmentPath?: string | null
}

/**
 * Maps a confirmed extraction to an `ExpenseInput` and creates a draft expense.
 * Marks the extraction row `confirmed`. Requires an explicit user confirmation.
 */
export async function confirmExpenseFromCapture(
  input: ConfirmCaptureInput,
): Promise<ExpenseActionResult> {
  const { parsed } = input

  const subtotal =
    parsed.subtotal ??
    (parsed.total != null && parsed.vatTotal != null
      ? parsed.total - parsed.vatTotal
      : 0)

  // Sadzba DPH sa NEHÁDA. Doteraz sa pri nevyťaženej sadzbe natvrdo dosadilo
  // 23 % — na potravinovom bločku (19 %) to znamenalo tichú chybu v daňovom
  // podklade. Keď ju model nevyťaží, odvodí sa zo súm; a keď ani to nejde,
  // ostane 0 % a používateľ ju doplní sám. Nula je viditeľná, 23 % nie.
  const vatRate = parsed.vatRate ?? deriveVatRate(subtotal, parsed.vatTotal)

  // Položky sa doteraz vyťažili a ZAHODILI, takže bloček s dvomi sadzbami
  // DPH sa nikdy nedal zaevidovať správne. `expense_items` ich unesie.
  const items =
    parsed.lines && parsed.lines.length > 0
      ? parsed.lines.map((l) => ({
          description: l.description ?? "",
          quantity: l.quantity ?? 1,
          unit: "ks",
          unitPrice: l.unitPrice ?? 0,
          vatRate: l.vatRate ?? vatRate,
        }))
      : undefined

  const res = await createExpense({
    supplierContactId: input.supplierContactId ?? undefined,
    documentNumber: parsed.documentNumber ?? undefined,
    issueDate: parsed.issueDate ?? undefined,
    supplyDate: parsed.supplyDate ?? undefined,
    dueDate: parsed.dueDate ?? undefined,
    currency: parsed.currency ?? "EUR",
    subtotal,
    vatRate,
    taxDeductible: true,
    attachmentUrl: input.attachmentPath ?? undefined,
    ...(items ? { items } : {}),
  })

  if (res.ok && input.extractionId) {
    const supabase = await createClient()
    await supabase
      .from("ai_extractions")
      .update({ status: "confirmed" })
      .eq("id", input.extractionId)
  }

  return res
}
