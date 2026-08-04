"use server"

import { createClient } from "@/lib/supabase/server"
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
export async function extractFromUpload(
  formData: FormData,
): Promise<ExtractCaptureResult> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, degraded: false, error: "Žiadny súbor." }
  }

  // Organizáciu zisťujeme PRED volaním modelu — inak by sa spálil token aj
  // vtedy, keď používateľ firmu nemá a výsledok sa aj tak zahodí.
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { ok: false, degraded: false, error: "Chýba firma." }
  }

  const limited = await checkAiRateLimit(supabase, orgId, "capture")
  if (!limited.ok) {
    return { ok: false, degraded: false, error: limited.error }
  }

  const data = new Uint8Array(Buffer.from(await file.arrayBuffer()))
  const mediaType = file.type || "application/octet-stream"

  const result = await documentExtractor.extract({ data, mediaType })
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
