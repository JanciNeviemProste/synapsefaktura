import { PLANS, PLAN_ORDER, type PlanTier } from "@/lib/billing/plans"
import { round } from "@/lib/money"

/**
 * Mesacny strop nakladov na AI — CISTA logika, ziadne I/O.
 *
 * `ai/generate.ts` nacita zaznamy z `ai_usage` za aktualny kalendarny mesiac a
 * samotne rozhodnutie necha na tieto funkcie, aby boli testovatelne cez vitest
 * (testy bezia v obycajnom node prostredi, bez DB a bez AI kluca).
 *
 * Naklady su v tej istej mene ako `ai/cost.ts` (odhad v USD).
 */

export type BudgetVerdict =
  | { withinBudget: true; used: number; limit: number | null }
  | { withinBudget: false; used: number; limit: number; reason: string }

/** Zaciatok aktualneho kalendarneho mesiaca v UTC ako ISO retazec. */
export function monthStartIso(now: Date): string {
  // UTC zamerne: `new Date(y, m, 1)` je lokalna polnoc a na non-UTC serveri by
  // sa hranica mesiaca posunula o den (rovnaky vzor ma billing/gate.ts).
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString()
}

/**
 * Scita `cost` zo zaznamov `ai_usage`. Postgres `numeric` moze prist aj ako
 * retazec; nepouzitelne hodnoty (null, NaN) sa ignoruju.
 */
export function sumUsageCost(
  rows: ReadonlyArray<{ cost: number | string | null }>,
): number {
  const total = rows.reduce((sum, row) => {
    const value =
      typeof row.cost === "string" ? Number(row.cost) : (row.cost ?? 0)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)
  return round(total, 6)
}

/** Mesacny strop nakladov na AI pre plan (null = bez stropu). */
export function aiCostLimit(tier: PlanTier): number | null {
  return PLANS[tier].aiMonthlyCostLimit
}

/** Najblizsi vyssi plan (pre "Upgrade na …"); null, ak je uz najvyssi. */
export function nextTierAfter(tier: PlanTier): PlanTier | null {
  const i = PLAN_ORDER.indexOf(tier)
  if (i < 0 || i >= PLAN_ORDER.length - 1) return null
  return PLAN_ORDER[i + 1]
}

/**
 * Je strop prekroceny? Fail-closed: nezmyselny sucet (NaN, Infinity) ratame ako
 * prekrocenie, aby sa chyba pri citani nezmenila na neobmedzene volania.
 */
export function isOverBudget(limit: number | null, usedCost: number): boolean {
  if (limit === null) return false
  if (!Number.isFinite(usedCost)) return true
  return usedCost >= limit
}

/** Rozhodnutie o mesacnom strope pre dany plan a uz minute naklady. */
export function checkAiBudget(tier: PlanTier, usedCost: number): BudgetVerdict {
  const used = Number.isFinite(usedCost)
    ? Math.max(0, usedCost)
    : Number.POSITIVE_INFINITY
  const limit = aiCostLimit(tier)
  if (limit === null) return { withinBudget: true, used, limit: null }
  if (!isOverBudget(limit, usedCost)) return { withinBudget: true, used, limit }
  return {
    withinBudget: false,
    used,
    limit,
    reason: `Mesačný limit nákladov na AI pre plán ${PLANS[tier].label} je vyčerpaný. Skúste to znova po začiatku ďalšieho mesiaca.`,
  }
}
