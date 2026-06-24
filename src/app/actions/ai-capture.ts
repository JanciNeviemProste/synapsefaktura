"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { documentExtractor, type ExtractedDocument } from "@/lib/ai/extractor"
import { createExpense, type ExpenseActionResult } from "@/app/actions/expenses"
import type { Json } from "@/lib/supabase/database.types"

export type ExtractCaptureResult =
  | {
      ok: true
      extractionId: string | null
      parsed: ExtractedDocument
      matchedContactId: string | null
    }
  | { ok: false; degraded: boolean; error: string }

/**
 * §7.1 — AI Document Capture. Reads an uploaded supplier doc, runs the
 * extractor, persists an `ai_extractions` row and tries to match the supplier
 * to an existing contact by IČO. Never auto-creates an expense (human-in-loop).
 */
export async function extractFromUpload(
  formData: FormData,
): Promise<ExtractCaptureResult> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, degraded: false, error: "Žiadny súbor." }
  }

  const data = new Uint8Array(Buffer.from(await file.arrayBuffer()))
  const mediaType = file.type || "application/octet-stream"

  const result = await documentExtractor.extract({ data, mediaType })
  if (!result.ok) {
    return { ok: false, degraded: result.degraded, error: result.error }
  }
  const parsed = result.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { ok: false, degraded: false, error: "Chýba firma." }
  }

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
  const vatRate = parsed.vatRate ?? 23

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
