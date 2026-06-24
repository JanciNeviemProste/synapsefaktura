import "server-only"

import {
  generateObject,
  generateText,
  stepCountIs,
  type ModelMessage,
  type ToolSet,
} from "ai"
import type { z } from "zod"

import { aiModel, hasAiKey, AI_MODEL } from "./provider"
import { estimateCost } from "./cost"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"

export type AiFeature =
  | "capture"
  | "nl_invoice"
  | "assistant"
  | "compliance"
  | "forecast"
  | "reminder"
  | "anomaly"

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; degraded: boolean; error: string }

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
  try {
    const { object, usage } = await generateObject({
      model: aiModel(),
      schema: opts.schema,
      system: opts.system,
      ...(opts.messages
        ? { messages: opts.messages }
        : { prompt: opts.prompt ?? "" }),
      // Allow zod unions/optionals that Google's strict structured mode rejects.
      providerOptions: { google: { structuredOutputs: false } },
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
