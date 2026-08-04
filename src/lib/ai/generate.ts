import "server-only"

import {
  generateObject,
  generateText,
  stepCountIs,
  type ModelMessage,
  type ToolSet,
} from "ai"
import type { z } from "zod"

import { aiBackend, aiModel, hasAiKey, AI_MODEL } from "./provider"
import { estimateCost } from "./cost"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { gateFeature } from "@/lib/billing/gate"
import type { Feature, PlanTier } from "@/lib/billing/plans"

export type AiFeature =
  | "capture"
  | "nl_invoice"
  | "assistant"
  | "compliance"
  | "forecast"
  | "reminder"
  | "anomaly"

/** Map an AI feature to the billing Feature it requires (null = not gated). */
function featureGate(feature: AiFeature): Feature | null {
  switch (feature) {
    case "capture":
      return "aiCapture"
    case "nl_invoice":
      return "nlInvoice"
    case "assistant":
      return "assistant"
    case "forecast":
      return "forecast"
    case "anomaly":
      return "anomaly"
    case "reminder":
      return "smartReminders"
    case "compliance":
      return null
  }
}

/** Resolve the org and enforce the plan gate for an AI feature, if gated. */
async function checkPlanGate(
  feature: AiFeature,
): Promise<
  | { ok: true }
  | { ok: false; degraded: true; error: string; upgrade: PlanTier }
> {
  const mapped = featureGate(feature)
  if (!mapped) return { ok: true }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: true }
  const gate = await gateFeature(supabase, orgId, mapped)
  if (!gate.allowed) {
    return {
      ok: false,
      degraded: true,
      error: gate.reason,
      upgrade: gate.requiredTier,
    }
  }
  return { ok: true }
}

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; degraded: boolean; error: string; upgrade?: PlanTier }

type Usage = { inputTokens?: number; outputTokens?: number } | undefined

/** Best-effort per-org usage/cost logging to ai_usage (§4/§7). Never throws. */
async function logUsage(feature: AiFeature, model: string, usage: Usage) {
  try {
    const supabase = await createClient()
    const orgId = await getCurrentOrgId(supabase)
    if (!orgId) return
    const input = usage?.inputTokens ?? 0
    const output = usage?.outputTokens ?? 0
    await supabase.from("ai_usage").insert({
      organization_id: orgId,
      feature,
      model,
      input_tokens: input,
      output_tokens: output,
      cost: estimateCost(model, input, output),
    })
  } catch {
    // logging is best-effort
  }
}

/**
 * Structured (zod-validated) generation. Pass `prompt` for text-only, or
 * `messages` for multimodal (OCR — image/file parts). Degrades gracefully when
 * no AI key is configured.
 */
export async function generateStructured<SCHEMA extends z.ZodType>(opts: {
  feature: AiFeature
  schema: SCHEMA
  system?: string
  prompt?: string
  messages?: ModelMessage[]
}): Promise<AiResult<z.infer<SCHEMA>>> {
  if (!hasAiKey()) {
    return { ok: false, degraded: true, error: "AI nie je nakonfigurované." }
  }
  const gate = await checkPlanGate(opts.feature)
  if (!gate.ok) return gate
  try {
    const { object, usage } = await generateObject({
      model: aiModel(),
      schema: opts.schema,
      system: opts.system,
      ...(opts.messages
        ? { messages: opts.messages }
        : { prompt: opts.prompt ?? "" }),
      // Allow zod unions/optionals that Google's strict structured mode rejects.
      // Only meaningful on the direct Google backend — provider options are
      // keyed by provider, so sending `google` while OpenRouter is active would
      // be silently dropped.
      ...(aiBackend() === "google"
        ? { providerOptions: { google: { structuredOutputs: false } } }
        : {}),
    })
    await logUsage(opts.feature, AI_MODEL, usage)
    return { ok: true, data: object as z.infer<SCHEMA> }
  } catch {
    return { ok: false, degraded: false, error: "AI volanie zlyhalo." }
  }
}

/**
 * Free-form / tool-using chat (assistant, NL invoice). Returns the final text and
 * the per-step trace. Degrades gracefully when no AI key is configured.
 */
export async function generateChat(opts: {
  feature: AiFeature
  system?: string
  messages: ModelMessage[]
  tools?: ToolSet
  maxSteps?: number
}): Promise<AiResult<{ text: string }>> {
  if (!hasAiKey()) {
    return { ok: false, degraded: true, error: "AI nie je nakonfigurované." }
  }
  const gate = await checkPlanGate(opts.feature)
  if (!gate.ok) return gate
  try {
    const result = await generateText({
      model: aiModel(),
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      stopWhen: stepCountIs(opts.maxSteps ?? 6),
    })
    await logUsage(opts.feature, AI_MODEL, result.usage)
    return { ok: true, data: { text: result.text } }
  } catch {
    return { ok: false, degraded: false, error: "AI volanie zlyhalo." }
  }
}
