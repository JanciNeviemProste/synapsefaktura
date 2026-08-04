import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { checkRateLimit } from "@/lib/security/rate-limit"
import { getOrgPlan } from "@/lib/billing/gate"
import { PLANS } from "@/lib/billing/plans"
import type { Database } from "@/lib/supabase/database.types"
import type { AiFeature } from "./generate"

/**
 * Nárazový limit na interaktívne AI volania.
 *
 * Mesačný strop nákladov (`aiMonthlyCostLimit`) chráni peňaženku, tento chráni
 * pred nárazom: bez neho môže jeden používateľ spustiť asistenta alebo
 * nahrávanie dokladov v cykle a minúť mesačný rozpočet za pár minút.
 *
 * Zámerne NIE je v `generate.ts` — tadiaľ chodí aj cron (upomienky), ktorý
 * legitímne generuje desiatky správ v jednom behu a centrálny limit by ho
 * zrezal. Volaj to len z akcií, ktoré spúšťa človek.
 *
 * Kľúč je na organizáciu a funkciu zvlášť, aby nahrávanie dokladov nevyčerpalo
 * limit asistentovi.
 */
export async function checkAiRateLimit(
  db: SupabaseClient<Database>,
  orgId: string,
  feature: AiFeature,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await getOrgPlan(db, orgId)
  const limit = PLANS[plan].aiCallsPerMinute
  const res = await checkRateLimit(`ai:${feature}:${orgId}`, limit, 60_000)
  if (res.ok) return { ok: true }
  return {
    ok: false,
    error: `Priveľa AI požiadaviek za sebou (limit ${limit}/min). Skúste o chvíľu.`,
  }
}
