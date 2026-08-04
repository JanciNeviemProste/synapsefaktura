import "server-only"

import {
  generateObject,
  generateText,
  stepCountIs,
  type ModelMessage,
  type ToolSet,
} from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { z } from "zod"

import { aiBackend, aiModel, hasAiKey, AI_MODEL } from "./provider"
import { estimateCost } from "./cost"
import {
  checkAiBudget,
  monthStartIso,
  nextTierAfter,
  sumUsageCost,
} from "./budget"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { gateFeature, getOrgPlan } from "@/lib/billing/gate"
import type { Feature, PlanTier } from "@/lib/billing/plans"
import type { Database } from "@/lib/supabase/database.types"

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

type Db = SupabaseClient<Database>

/** Jednotna sprava z neznamej chyby (provider, DB, schema) pre logy. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

type GateResult =
  | { ok: true }
  | { ok: false; degraded: true; error: string; upgrade?: PlanTier }

/**
 * Resolve the client + org used for gating and usage accounting.
 *
 * Volajuci moze orgId dodat sam — to je jedina cesta pre systemove behy (cron),
 * kde niet session a `getCurrentOrgId()` by vratil null. V takom pripade
 * pouzivame service-role klienta, lebo anonymne RLS by na plan aj na `ai_usage`
 * nedovidelo. POZOR: dodane orgId musi volajuci overit sam, nikdy ho neber
 * priamo z requestu pouzivatela.
 */
async function resolveOrg(
  orgId?: string,
): Promise<{ db: Db; orgId: string } | null> {
  try {
    if (orgId) return { db: createAdminClient(), orgId }
    const supabase = await createClient()
    const current = await getCurrentOrgId(supabase)
    if (!current) return null
    return { db: supabase, orgId: current }
  } catch (err) {
    console.error("[ai] org resolution failed", errMessage(err))
    return null
  }
}

/**
 * Monthly AI cost cap (§4). Scita `ai_usage.cost` za aktualny kalendarny mesiac
 * a porovna so stropom planu. Fail-closed rovnako ako limit dokladov: ked sa
 * sucet neda overit, volanie nepustime.
 */
async function checkCostCap(
  db: Db,
  orgId: string,
  feature: AiFeature,
): Promise<GateResult> {
  const plan = await getOrgPlan(db, orgId)
  const { data, error } = await db
    .from("ai_usage")
    .select("cost")
    .eq("organization_id", orgId)
    .gte("created_at", monthStartIso(new Date()))
  if (error) {
    console.error("[ai] cost cap check failed", feature, error.message)
    return {
      ok: false,
      degraded: true,
      error: "Nepodarilo sa overiť mesačný limit nákladov na AI.",
    }
  }
  const verdict = checkAiBudget(plan, sumUsageCost(data ?? []))
  if (verdict.withinBudget) return { ok: true }
  console.error(
    "[ai] monthly cost cap reached",
    feature,
    `org=${orgId}`,
    `plan=${plan}`,
    `used=${verdict.used}/${verdict.limit}`,
  )
  const upgrade = nextTierAfter(plan)
  return {
    ok: false,
    degraded: true,
    error: verdict.reason,
    ...(upgrade ? { upgrade } : {}),
  }
}

/**
 * Resolve the org and enforce the plan gate for an AI feature, if gated, plus
 * the monthly cost cap. `orgId` je volitelne — dodaj ho vsade, kde niet session
 * (cron). Bez znamej organizacie zamietame (fail-closed): inak by AI bezala aj
 * pre Free organizacie a bez akehokolvek stropu nakladov.
 */
async function checkPlanGate(
  feature: AiFeature,
  orgId?: string,
): Promise<GateResult> {
  const ctx = await resolveOrg(orgId)
  if (!ctx) {
    console.error("[ai] plan gate: unknown org — denying", feature)
    return {
      ok: false,
      degraded: true,
      error: "Organizáciu sa nepodarilo určiť, AI je nedostupné.",
    }
  }
  const mapped = featureGate(feature)
  if (mapped) {
    const gate = await gateFeature(ctx.db, ctx.orgId, mapped)
    if (!gate.allowed) {
      return {
        ok: false,
        degraded: true,
        error: gate.reason,
        upgrade: gate.requiredTier,
      }
    }
  }
  return checkCostCap(ctx.db, ctx.orgId, feature)
}

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; degraded: boolean; error: string; upgrade?: PlanTier }

type Usage = { inputTokens?: number; outputTokens?: number } | undefined

/**
 * Best-effort per-org usage/cost logging to ai_usage (§4/§7). Never throws.
 * `orgId` chodi rovnakou cestou ako do gate-u — bez neho by sa systemove behy
 * (cron) nikde nezauctovali a mesacny strop by nemal z coho ratat.
 */
async function logUsage(
  feature: AiFeature,
  model: string,
  usage: Usage,
  orgId?: string,
) {
  try {
    const ctx = await resolveOrg(orgId)
    if (!ctx) {
      console.error("[ai] usage not logged: unknown org", feature, model)
      return
    }
    const input = usage?.inputTokens ?? 0
    const output = usage?.outputTokens ?? 0
    const { error } = await ctx.db.from("ai_usage").insert({
      organization_id: ctx.orgId,
      feature,
      model,
      input_tokens: input,
      output_tokens: output,
      cost: estimateCost(model, input, output),
    })
    if (error) {
      console.error("[ai] usage insert failed", feature, model, error.message)
    }
  } catch (err) {
    // logging is best-effort
    console.error("[ai] usage logging failed", feature, model, errMessage(err))
  }
}

/**
 * Structured (zod-validated) generation. Pass `prompt` for text-only, or
 * `messages` for multimodal (OCR — image/file parts). Degrades gracefully when
 * no AI key is configured. `orgId` dodaj vsade, kde niet session (cron).
 */
export async function generateStructured<SCHEMA extends z.ZodType>(opts: {
  feature: AiFeature
  schema: SCHEMA
  system?: string
  prompt?: string
  messages?: ModelMessage[]
  orgId?: string
}): Promise<AiResult<z.infer<SCHEMA>>> {
  if (!hasAiKey()) {
    return { ok: false, degraded: true, error: "AI nie je nakonfigurované." }
  }
  const gate = await checkPlanGate(opts.feature, opts.orgId)
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
    await logUsage(opts.feature, AI_MODEL, usage, opts.orgId)
    return { ok: true, data: object as z.infer<SCHEMA> }
  } catch (err) {
    // Bez logu su vypadok providera, chyba schemy a vycerpana kvota
    // v logoch nerozoznatelne.
    console.error(
      "[ai] generateStructured failed",
      opts.feature,
      AI_MODEL,
      errMessage(err),
    )
    return { ok: false, degraded: false, error: "AI volanie zlyhalo." }
  }
}

/**
 * Free-form / tool-using chat (assistant, NL invoice). Returns the final text and
 * the per-step trace. Degrades gracefully when no AI key is configured.
 * `orgId` dodaj vsade, kde niet session (cron).
 */
export async function generateChat(opts: {
  feature: AiFeature
  system?: string
  messages: ModelMessage[]
  tools?: ToolSet
  maxSteps?: number
  orgId?: string
}): Promise<AiResult<{ text: string }>> {
  if (!hasAiKey()) {
    return { ok: false, degraded: true, error: "AI nie je nakonfigurované." }
  }
  const gate = await checkPlanGate(opts.feature, opts.orgId)
  if (!gate.ok) return gate
  try {
    const result = await generateText({
      model: aiModel(),
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      stopWhen: stepCountIs(opts.maxSteps ?? 6),
    })
    await logUsage(opts.feature, AI_MODEL, result.usage, opts.orgId)
    return { ok: true, data: { text: result.text } }
  } catch (err) {
    // Bez logu su vypadok providera, chyba nastroja a vycerpana kvota
    // v logoch nerozoznatelne.
    console.error(
      "[ai] generateChat failed",
      opts.feature,
      AI_MODEL,
      errMessage(err),
    )
    return { ok: false, degraded: false, error: "AI volanie zlyhalo." }
  }
}
