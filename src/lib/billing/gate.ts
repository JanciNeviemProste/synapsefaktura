import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  PLANS,
  planHasFeature,
  minTierFor,
  type Feature,
  type PlanTier,
} from "./plans"

/**
 * Server-side plan gating. Pure-ish helpers reused by every gate point
 * (e-invoice send, AI actions, document issue). When Stripe is unconfigured the
 * org's `plan` column is simply `free` and gates still work.
 */

type DB = SupabaseClient<Database>

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: string; requiredTier: PlanTier }

export async function getOrgPlan(db: DB, orgId: string): Promise<PlanTier> {
  const { data } = await db
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .maybeSingle()
  return data?.plan ?? "free"
}

/** Gate a feature for an org. */
export async function gateFeature(
  db: DB,
  orgId: string,
  feature: Feature,
): Promise<GateResult> {
  const plan = await getOrgPlan(db, orgId)
  if (planHasFeature(plan, feature)) return { allowed: true }
  const requiredTier = minTierFor(feature)
  return {
    allowed: false,
    requiredTier,
    reason: `Táto funkcia je dostupná v pláne ${PLANS[requiredTier].label}.`,
  }
}

/** Count issued documents in the current calendar month (Free monthly limit). */
export async function issuedThisMonth(db: DB, orgId: string): Promise<number> {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const { count } = await db
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .neq("status", "draft")
    .gte("issue_date", from)
  return count ?? 0
}

/** Gate issuing another document against the plan's monthly limit. */
export async function gateDocumentIssue(
  db: DB,
  orgId: string,
): Promise<GateResult> {
  const plan = await getOrgPlan(db, orgId)
  const limit = PLANS[plan].docsPerMonth
  if (limit === null) return { allowed: true }
  const used = await issuedThisMonth(db, orgId)
  if (used < limit) return { allowed: true }
  return {
    allowed: false,
    requiredTier: "pro",
    reason: `V pláne ${PLANS[plan].label} môžete vystaviť ${limit} dokladov mesačne. Prejdite na Pro pre neobmedzené doklady.`,
  }
}
