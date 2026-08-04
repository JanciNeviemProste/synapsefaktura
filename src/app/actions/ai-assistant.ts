"use server"

import { randomUUID } from "node:crypto"

import { z } from "zod"
import { tool, type ModelMessage, type ToolSet } from "ai"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { formatMoney, round2 } from "@/lib/money"
import { generateChat, type AiFailureReason } from "@/lib/ai/generate"
import { checkAiRateLimit } from "@/lib/ai/rate-limit"
import type { PlanTier } from "@/lib/billing/plans"

/** Invoice statuses that represent money still owed (not draft, not paid/cancelled). */
const OPEN_STATUSES = ["issued", "sent", "partially_paid", "overdue"] as const

/** How many contact candidates `summarize_client` looks at before giving up. */
const CLIENT_MATCH_LIMIT = 5

/** How many of the newest thread messages are sent to the model as context. */
const HISTORY_LIMIT = 20

/** A single rendered chat turn for the UI. */
export interface AssistantMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

export type SendAssistantResult =
  | { ok: true; threadId: string; reply: string }
  | {
      ok: false
      degraded: boolean
      error: string
      /** Prítomné, keď zlyhanie rieši upgrade tarifu — UI otvorí UpgradeDialog. */
      upgrade?: PlanTier
      reason?: AiFailureReason
    }

/** Slovak assistant persona. Grounding is enforced: numbers MUST come from tools. */
const SYSTEM_PROMPT = [
  "Si účtovný asistent pre slovenskú firmu v aplikácii Synapse Faktúra.",
  "Odpovedáš po slovensky, stručne a vecne.",
  "DÔLEŽITÉ — uzemnenie v dátach:",
  "- Akékoľvek čísla (sumy, počty, dni) musíš získať VÝHRADNE volaním nástrojov (query_revenue, list_overdue, summarize_client). Nikdy si čísla nevymýšľaj ani neodhaduj z pamäte.",
  "- Ak nástroj nevráti dáta alebo na otázku nemáš podklad, povedz jasne „Neviem / chýbajú dáta.“ Nikdy nefabrikuj.",
  "- V odpovedi uveď, z ktorých záznamov čísla pochádzajú (napr. počet faktúr, meno klienta, obdobie).",
  "- Sumy formátuj tak, ako ich vráti nástroj (sú už v eurách).",
  "Buď nápomocný, no radšej priznaj chýbajúce dáta, než by si uviedol nepresné číslo.",
].join("\n")

/** Resolve the period to an inclusive [from, to] ISO date range (YYYY-MM-DD). */
function periodRange(period: "this_month" | "last_month" | "this_year"): {
  from: string
  to: string
} {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (period === "this_year") {
    return { from: `${y}-01-01`, to: iso(new Date(y, 11, 31)) }
  }
  if (period === "last_month") {
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    return { from: iso(start), to: iso(end) }
  }
  // this_month
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  return { from: iso(start), to: iso(end) }
}

/**
 * Build the read-only tool set. Tools close over the RLS-scoped `supabase`
 * client so they only ever see the caller's organization's rows.
 */
function buildTools(
  supabase: Awaited<ReturnType<typeof createClient>>,
): ToolSet {
  return {
    query_revenue: tool({
      description:
        "Vráti súčet fakturovaných súm (total) za zvolené obdobie pre nezrušené, " +
        "nie-konceptové faktúry. Použi pre otázky typu 'koľko som vyfakturoval'.",
      inputSchema: z.object({
        period: z
          .enum(["this_month", "last_month", "this_year"])
          .describe("Obdobie: tento mesiac, minulý mesiac alebo tento rok."),
      }),
      execute: async ({ period }) => {
        const { from, to } = periodRange(period)
        const { data, error } = await supabase
          .from("documents")
          .select("total, status")
          .eq("type", "invoice")
          .neq("status", "draft")
          .neq("status", "cancelled")
          .gte("issue_date", from)
          .lte("issue_date", to)
        if (error) return { error: "Nepodarilo sa načítať faktúry." }
        const rows = data ?? []
        const sum = round2(rows.reduce((acc, r) => acc + (r.total ?? 0), 0))
        return {
          period,
          from,
          to,
          invoiceCount: rows.length,
          revenue: sum,
          revenueFormatted: formatMoney(sum),
        }
      },
    }),

    list_overdue: tool({
      description:
        "Vráti zoznam faktúr po splatnosti (due_date < dnes) so stavom issued, " +
        "sent, partially_paid alebo overdue. Pre každú vráti číslo, klienta a " +
        "nesplatenú sumu.",
      inputSchema: z.object({}),
      execute: async () => {
        const today = new Date().toISOString().slice(0, 10)
        const { data, error } = await supabase
          .from("documents")
          .select("number, total, paid_amount, due_date, contacts(name)")
          .eq("type", "invoice")
          .in("status", OPEN_STATUSES)
          .lt("due_date", today)
          .order("due_date", { ascending: true })
        if (error)
          return { error: "Nepodarilo sa načítať faktúry po splatnosti." }
        const items = (data ?? []).map((d) => {
          const outstanding = round2((d.total ?? 0) - (d.paid_amount ?? 0))
          return {
            number: d.number ?? "—",
            customer: relatedName(d.contacts) ?? "Neznámy klient",
            dueDate: d.due_date,
            outstanding,
            outstandingFormatted: formatMoney(outstanding),
          }
        })
        const totalOutstanding = round2(
          items.reduce((acc, i) => acc + i.outstanding, 0),
        )
        return {
          count: items.length,
          totalOutstanding,
          totalOutstandingFormatted: formatMoney(totalOutstanding),
          items,
        }
      },
    }),

    summarize_client: tool({
      description:
        "Nájde klienta podľa (čiastočného) mena a vráti súhrn: celkovo " +
        "fakturované, uhradené, nesplatené a priemerný počet dní do úhrady. " +
        "Ak menu zodpovedá viac klientov a ani jeden nie je presnou zhodou, " +
        "nevráti súhrn, ale zoznam kandidátov (ambiguous: true) — vtedy sa " +
        "musíš používateľa opýtať, ktorého klienta myslí.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Meno klienta (aj čiastočné)."),
      }),
      execute: async ({ name }) => {
        const { data: contacts, error: cErr } = await supabase
          .from("contacts")
          .select("id, name")
          .ilike("name", `%${name}%`)
          .order("name", { ascending: true })
          .limit(CLIENT_MATCH_LIMIT)
        if (cErr) return { error: "Nepodarilo sa vyhľadať klienta." }
        if (!contacts || contacts.length === 0) {
          return { found: false, message: `Klient „${name}“ sa nenašiel.` }
        }

        // A match is unambiguous only when it is the single hit, or the single
        // exact name match. Otherwise we refuse to summarise the wrong client.
        const needle = normalizeName(name)
        const exact = contacts.filter((c) => normalizeName(c.name) === needle)
        const contact =
          exact.length === 1
            ? exact[0]
            : contacts.length === 1
              ? contacts[0]
              : null

        if (!contact) {
          const candidates = contacts.map((c) => c.name)
          return {
            found: false,
            ambiguous: true,
            query: name,
            candidates,
            truncated: contacts.length >= CLIENT_MATCH_LIMIT,
            message:
              `Menu „${name}“ zodpovedá viac klientov (${candidates.join(", ")}) ` +
              "a ani jeden nie je presnou zhodou. Súhrn nevraciam. Opýtaj sa " +
              "používateľa, ktorého z nich myslí, a zavolaj nástroj znova s " +
              "presným menom. Nehádaj a neuveď žiadne čísla.",
          }
        }

        const { data: docs, error: dErr } = await supabase
          .from("documents")
          .select(
            "total, paid_amount, status, issue_date, due_date, payments(paid_at)",
          )
          .eq("type", "invoice")
          .eq("contact_id", contact.id)
          .neq("status", "draft")
          .neq("status", "cancelled")
        if (dErr) return { error: "Nepodarilo sa načítať faktúry klienta." }

        const rows = docs ?? []
        const invoiced = round2(rows.reduce((a, d) => a + (d.total ?? 0), 0))
        const paid = round2(rows.reduce((a, d) => a + (d.paid_amount ?? 0), 0))
        const outstanding = round2(invoiced - paid)

        // Average days-to-pay over invoices with a recorded payment.
        const daysSamples: number[] = []
        for (const d of rows) {
          if (!d.issue_date) continue
          const pays = (d.payments ?? []) as { paid_at: string | null }[]
          const latest = pays
            .map((p) => p.paid_at)
            .filter((x): x is string => Boolean(x))
            .sort()
            .at(-1)
          if (!latest) continue
          const issued = new Date(d.issue_date).getTime()
          const paidAt = new Date(latest).getTime()
          if (Number.isFinite(issued) && Number.isFinite(paidAt)) {
            daysSamples.push(Math.round((paidAt - issued) / 86_400_000))
          }
        }
        const avgDaysToPay =
          daysSamples.length > 0
            ? Math.round(
                daysSamples.reduce((a, b) => a + b, 0) / daysSamples.length,
              )
            : null

        return {
          found: true,
          client: contact.name,
          otherMatches: contacts
            .filter((c) => c.id !== contact.id)
            .map((c) => c.name),
          invoiceCount: rows.length,
          invoiced,
          invoicedFormatted: formatMoney(invoiced),
          paid,
          paidFormatted: formatMoney(paid),
          outstanding,
          outstandingFormatted: formatMoney(outstanding),
          avgDaysToPay,
          avgDaysToPaySamples: daysSamples.length,
        }
      },
    }),
  }
}

/** Normalise a contact name for exact-match comparison (case + whitespace). */
function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

/** Supabase embeds 1:1 relations as object or (rarely) array — normalise to a name. */
function relatedName(rel: unknown): string | null {
  if (!rel) return null
  const row = Array.isArray(rel) ? rel[0] : rel
  if (row && typeof row === "object" && "name" in row) {
    const n = (row as { name: unknown }).name
    return typeof n === "string" ? n : null
  }
  return null
}

/**
 * Send a user message to the assistant for a thread (creating one if needed).
 * Persists both the user message and the assistant reply to `ai_messages`,
 * grounding all figures in read-only tools over the caller's org.
 */
export async function sendAssistantMessage(input: {
  threadId?: string
  text: string
}): Promise<SendAssistantResult> {
  const text = input.text?.trim()
  if (!text) {
    return { ok: false, degraded: false, error: "Prázdna správa." }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { ok: false, degraded: false, error: "Chýba firma." }
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, degraded: false, error: "Nie si prihlásený." }
  }

  // Kontrolujeme skôr, než sa správa uloží — inak by odmietnuté pokusy
  // zaplnili vlákno a rástol by kontext ďalších volaní.
  const limited = await checkAiRateLimit(supabase, orgId, "assistant")
  if (!limited.ok) {
    return { ok: false, degraded: false, error: limited.error }
  }

  const threadId = input.threadId ?? randomUUID()

  // Persist the user's message first so it survives even if AI fails.
  await supabase.from("ai_messages").insert({
    organization_id: orgId,
    user_id: user.id,
    thread_id: threadId,
    role: "user",
    content: text,
  })

  // Load the newest turns only (including the one we just stored) — an
  // unbounded thread would grow context and cost without limit.
  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT)

  // Newest-first from the DB — flip back to chronological order for the model.
  const recentTurns = [...(history ?? [])]
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")

  // The window must open with a user turn — cutting mid-thread can leave a
  // dangling assistant reply first, which some providers reject.
  const firstUser = recentTurns.findIndex((m) => m.role === "user")
  const messages: ModelMessage[] = (
    firstUser >= 0 ? recentTurns.slice(firstUser) : []
  ).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content ?? "",
  }))

  // Fallback in the unlikely case history read failed.
  if (messages.length === 0) {
    messages.push({ role: "user", content: text })
  }

  const ai = await generateChat({
    feature: "assistant",
    system: SYSTEM_PROMPT,
    messages,
    tools: buildTools(supabase),
    maxSteps: 6,
  })

  if (!ai.ok) {
    return {
      ok: false,
      degraded: ai.degraded,
      error: ai.error,
      reason: ai.reason,
      ...(ai.upgrade ? { upgrade: ai.upgrade } : {}),
    }
  }

  const reply =
    ai.data.text.trim() || "Neviem — k tejto otázke mi chýbajú dáta."

  await supabase.from("ai_messages").insert({
    organization_id: orgId,
    user_id: user.id,
    thread_id: threadId,
    role: "assistant",
    content: reply,
  })

  return { ok: true, threadId, reply }
}

/**
 * Start a fresh, empty thread. Nothing is persisted yet — the id becomes a real
 * thread once the first message is sent with it.
 */
export async function startAssistantThread(): Promise<
  { ok: true; threadId: string } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { ok: false, error: "Chýba firma." }
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Nie si prihlásený." }
  }
  return { ok: true, threadId: randomUUID() }
}

/** Load all messages for a thread, oldest-first, for rendering the chat. */
export async function getThreadMessages(
  threadId: string,
): Promise<AssistantMessage[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const { data } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })

  return (data ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
      createdAt: m.created_at,
    }))
}

/** Resolve the caller's most recent thread id (for landing on the page), or null. */
export async function getLatestThreadId(): Promise<string | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return null

  const { data } = await supabase
    .from("ai_messages")
    .select("thread_id, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.thread_id ?? null
}
