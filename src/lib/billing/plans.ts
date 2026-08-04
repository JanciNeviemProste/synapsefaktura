import type { Database } from "@/lib/supabase/database.types"

/**
 * Plan catalog + feature matrix (§8.1). CLIENT-SAFE: plain data only, no secrets,
 * no server-only imports — both the billing UI and server gates read this.
 *
 * Pricing/limits are placeholders — final numbers are a business decision.
 * // TODO: confirm final tiers, prices and the Free monthly document limit.
 */

export type PlanTier = Database["public"]["Enums"]["plan_tier"]

/** Gated capabilities. A plan either grants a feature or it doesn't. */
export type Feature =
  | "aiCapture"
  | "nlInvoice"
  | "assistant"
  | "smartReminders"
  | "forecast"
  | "anomaly"
  | "multiUser"
  | "peppolSend"
  | "advancedReports"
  | "api"

export type PlanDef = {
  tier: PlanTier
  label: string
  /** Indicative monthly price in EUR, or null for Free. */
  priceEur: string | null
  /** Issued documents per calendar month; null = unlimited. */
  docsPerMonth: number | null
  /**
   * Mesačný strop nákladov na AI na organizáciu (kalendárny mesiac), v tej istej
   * mene ako `ai/cost.ts` — teda odhad v USD, nie EUR; null = bez stropu.
   * Bráni úteku nákladov, keď sa AI volania nekontrolovane opakujú.
   */
  aiMonthlyCostLimit: number | null
  /**
   * Maximum interaktívnych AI volaní na organizáciu za minútu.
   *
   * Mesačný strop chráni peňaženku, tento chráni pred nárazom — bez neho môže
   * jeden používateľ spustiť asistenta alebo nahrávanie dokladov v cykle
   * a minúť mesačný rozpočet za pár minút.
   *
   * Týka sa len interaktívnych akcií. Cron (upomienky) zámerne nelimitujeme —
   * legitímne generuje desiatky správ v jednom behu.
   */
  aiCallsPerMinute: number
  features: ReadonlySet<Feature>
  /** Env var holding the Stripe price id for checkout (server reads it). */
  stripePriceEnv?: string
  /** Short marketing blurb (SK). */
  blurb: string
}

const ALL: Feature[] = [
  "aiCapture",
  "nlInvoice",
  "assistant",
  "smartReminders",
  "forecast",
  "anomaly",
  "multiUser",
  "peppolSend",
  "advancedReports",
  "api",
]

export const PLANS: Record<PlanTier, PlanDef> = {
  free: {
    tier: "free",
    label: "Free",
    priceEur: null,
    docsPerMonth: 5, // TODO: business decision
    aiMonthlyCostLimit: 0.25, // TODO: business decision
    aiCallsPerMinute: 5, // TODO: business decision
    features: new Set<Feature>([]),
    blurb: "Základná fakturácia a príjem e-faktúr (Peppol). Ideálne pred 2027.",
  },
  pro: {
    tier: "pro",
    label: "Pro",
    priceEur: "12",
    docsPerMonth: null,
    aiMonthlyCostLimit: 3, // TODO: business decision
    aiCallsPerMinute: 20, // TODO: business decision
    features: new Set<Feature>([
      "aiCapture",
      "nlInvoice",
      "assistant",
      "smartReminders",
      "anomaly",
    ]),
    stripePriceEnv: "STRIPE_PRICE_PRO",
    blurb: "Neobmedzené doklady + AI: vyťaženie, fakturácia vetou, asistent.",
  },
  business: {
    tier: "business",
    label: "Business",
    priceEur: "29",
    docsPerMonth: null,
    aiMonthlyCostLimit: 10, // TODO: business decision
    aiCallsPerMinute: 40, // TODO: business decision
    features: new Set<Feature>(ALL),
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
    blurb: "Všetko z Pro + prognózy, viac používateľov, odosielanie e-faktúr, API.",
  },
}

export const PLAN_ORDER: PlanTier[] = ["free", "pro", "business"]

/** Does a plan grant a feature? */
export function planHasFeature(tier: PlanTier, feature: Feature): boolean {
  return PLANS[tier].features.has(feature)
}

/** Lowest tier that grants a feature (for "Upgrade na …" copy). */
export function minTierFor(feature: Feature): PlanTier {
  return PLAN_ORDER.find((t) => PLANS[t].features.has(feature)) ?? "business"
}
