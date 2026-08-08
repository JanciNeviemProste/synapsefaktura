/**
 * Smart payment reminders (§7.6).
 *
 * Upgrades the Phase-2 template reminders with:
 *  - a pure payment-behaviour score derived from a customer's historic lateness,
 *  - a pure lateness prediction (median late days),
 *  - an AI-drafted, tone-aware Slovak reminder body.
 *
 * The AI path degrades cleanly: when no AI key is configured, the AI call is
 * `degraded`, or the call fails, we fall back to the existing template from
 * `templates.ts` — callers never have to handle a crash.
 *
 * Note: this module is not marked `server-only` itself so the pure scoring
 * helpers stay unit-testable; the AI path is server-guarded transitively via
 * `@/lib/ai/generate` (which is `server-only`).
 */

import { z } from "zod"

import {
  reminderTemplate,
  type ReminderContext,
  type ReminderMessage,
} from "@/lib/reminders/templates"

const TONES = ["gentle", "firm", "final"] as const
type Tone = (typeof TONES)[number]

/**
 * `ReminderMessage` doplnena o priznak, ci telo naozaj napisalo AI.
 * `aiGenerated: false` znamena sablonovy fallback (degraded alebo zlyhanie AI).
 */
export interface SmartReminderMessage extends ReminderMessage {
  aiGenerated: boolean
}

/**
 * POZN.: zatial nie je zapojene do UI ani do jobov. Urcene pre stlpec
 * `contacts.payment_behavior_score` — prepocitat pri parovani platieb
 * (`src/lib/matching/*`) alebo v crone a ulozit ku kontaktu.
 *
 * Score a customer's payment behaviour on a 0..100 scale where higher means
 * "pays on time". Input is the list of how many days late each historic
 * invoice was paid (0 = on time, negative values are clamped to 0 / early).
 *
 * Pure. Empty history → neutral 50 (we have no signal yet).
 */
export function paymentBehaviourScore(paidLateDays: number[]): number {
  if (paidLateDays.length === 0) return 50

  // Average lateness, with early/on-time payments counted as 0 days late.
  const avgLate =
    paidLateDays.reduce((sum, d) => sum + Math.max(0, d), 0) /
    paidLateDays.length

  // Map average lateness to a score: 0 days → 100, 30+ days → 0 (linear).
  const SATURATION_DAYS = 30
  const penalty = Math.min(avgLate, SATURATION_DAYS) / SATURATION_DAYS
  const score = 100 * (1 - penalty)

  return Math.round(Math.min(100, Math.max(0, score)))
}

/**
 * POZN.: zatial nie je zapojene. Urcene pre predikciu uhrady na detaile
 * kontaktu / faktury a pre planovanie upomienok (`src/lib/jobs/reminders.ts`)
 * — napr. neposielat upomienku skor, ako je ocakavane omeskanie.
 *
 * Predict how many days late the next invoice will likely be paid, using the
 * median of historic lateness (robust to outliers). Early/on-time payments
 * count as 0. Pure. Empty history → 0.
 */
export function predictLatenessDays(history: number[]): number {
  if (history.length === 0) return 0

  const sorted = history.map((d) => Math.max(0, d)).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  return Math.round(median)
}

function toneForLevel(level: number): Tone {
  const lvl = Math.min(Math.max(level, 1), 3)
  return TONES[lvl - 1]
}

const aiSchema = z.object({
  subject: z.string(),
  body: z.string(),
  tone: z.enum(TONES),
})

const TONE_GUIDANCE: Record<Tone, string> = {
  gentle:
    "Zdvorilé a priateľské pripomenutie. Predpokladaj, že nezaplatenie je len opomenutie. Žiadny nátlak.",
  firm: "Dôraznejšia, ale stále profesionálna a vecná žiadosť o bezodkladnú úhradu. Zdôrazni, že faktúra je po splatnosti.",
  final:
    "Posledná výzva pred ďalšími krokmi (vymáhanie pohľadávky). Formálny, rozhodný tón, bez vyhrážok.",
}

/**
 * Draft an escalating Slovak reminder body in the tone appropriate for `level`
 * (1 = gentle, 2 = firm, 3 = final). Uses AI when available; on degraded/failed
 * AI it falls back to the existing template. The returned `level` and `tone`
 * always match the requested level, regardless of path; `aiGenerated` says
 * which path actually produced the body.
 */
export async function smartReminderBody(
  level: number,
  ctx: ReminderContext,
  systemOrgId?: string,
): Promise<SmartReminderMessage> {
  const lvl = Math.min(Math.max(level, 1), 3)
  const tone = toneForLevel(lvl)

  // Lazy import keeps the pure scoring helpers above free of the server-only
  // AI module graph, so they stay unit-testable in a plain node environment.
  const { generateStructured } = await import("@/lib/ai/generate")

  const result = await generateStructured({
    feature: "reminder",
    schema: aiSchema,
    // Cron bezi bez session, takze `getCurrentOrgId()` by vratil null a gate by
    // (fail-closed) zamietol kazdu upomienku — aj platiacim. Organizaciu preto
    // dodava volajuci; pochadza z uz nacitaneho dokladu, nie z requestu.
    systemOrgId,
    system:
      "Si asistent slovenskej fakturačnej aplikácie. Píšeš upomienky (výzvy na úhradu) " +
      "v spisovnej slovenčine, vecne a profesionálne. Vráť IBA štruktúrovaný výstup. " +
      "Telo správy začni oslovením a ukonči podpisom dodávateľa. Nepoužívaj zástupné polia.",
    prompt:
      `Vytvor upomienku úrovne ${lvl}. Tón: ${TONE_GUIDANCE[tone]}\n\n` +
      `Údaje:\n` +
      `- Číslo faktúry: ${ctx.documentNumber}\n` +
      `- Odberateľ: ${ctx.customerName}\n` +
      `- Suma na úhradu: ${ctx.amount}\n` +
      `- Dátum splatnosti: ${ctx.dueDate}\n` +
      `- Počet dní po splatnosti: ${ctx.daysOverdue}\n` +
      `- Dodávateľ (podpis): ${ctx.supplierName}\n\n` +
      `Predmet (subject) nech obsahuje číslo faktúry. Telo (body) napíš ako celý text e-mailu.`,
  })

  if (!result.ok) {
    // degraded (no key) or hard AI failure → existing template.
    return { ...reminderTemplate(lvl, ctx), aiGenerated: false }
  }

  return {
    level: lvl,
    tone,
    subject: result.data.subject,
    body: result.data.body,
    aiGenerated: true,
  }
}
