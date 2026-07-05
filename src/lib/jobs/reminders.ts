import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatMoney } from "@/lib/money"
import { smartReminderBody } from "@/lib/reminders/smart"
import { hasAiKey } from "@/lib/ai/provider"
import { hasEmail, sendEmail } from "@/lib/email/provider"
import { reminderEmail } from "@/lib/email/templates"

type Db = SupabaseClient<Database>

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime()
  const b = new Date(toIso).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * Composes and stores a reminder for one document (works with either a user or
 * admin client). Email/SMS delivery is a Phase-2 stub (status flips to sent).
 */
export async function createReminderForDocument(
  db: Db,
  documentId: string,
  level?: number,
): Promise<{
  ok: boolean
  error?: string
  level?: number
  delivered?: boolean
}> {
  const { data: doc } = await db
    .from("documents")
    .select(
      "id, organization_id, number, total, paid_amount, due_date, contact_id, language",
    )
    .eq("id", documentId)
    .maybeSingle()
  if (!doc) return { ok: false, error: "Doklad sa nenašiel." }

  const [{ count }, { data: org }, { data: contact }] = await Promise.all([
    db
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId),
    db
      .from("organizations")
      .select("name")
      .eq("id", doc.organization_id)
      .maybeSingle(),
    doc.contact_id
      ? db
          .from("contacts")
          .select("name, email")
          .eq("id", doc.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const nextLevel = level ?? (count ?? 0) + 1
  if (nextLevel > 3) return { ok: false, error: "Dosiahnutá maximálna úroveň." }

  const today = new Date().toISOString().slice(0, 10)
  const msg = await smartReminderBody(nextLevel, {
    documentNumber: doc.number ?? "—",
    customerName: contact?.name ?? "odberateľ",
    amount: formatMoney(doc.total - doc.paid_amount),
    dueDate: doc.due_date ? doc.due_date.split("-").reverse().join(".") : "—",
    daysOverdue: doc.due_date ? daysBetween(doc.due_date, today) : 0,
    supplierName: org?.name ?? "",
  })

  // Attempt real delivery; only stamp sent_at when the email actually went out.
  const nowIso = new Date().toISOString()
  let sentAt: string | null = null
  if (hasEmail() && contact?.email) {
    const { subject, html } = reminderEmail({
      lang: doc.language,
      docNumber: doc.number ?? "—",
      supplierName: org?.name ?? "",
      body: msg.body,
    })
    const res = await sendEmail({ to: contact.email, subject, html })
    if (res.ok) sentAt = nowIso
  }

  const { error } = await db.from("reminders").insert({
    organization_id: doc.organization_id,
    document_id: documentId,
    level: msg.level,
    channel: "email",
    tone: msg.tone,
    body: msg.body,
    scheduled_at: nowIso,
    sent_at: sentAt,
    ai_generated: hasAiKey(),
  })
  if (error) return { ok: false, error: "Upomienku sa nepodarilo uložiť." }

  return { ok: true, level: msg.level, delivered: Boolean(sentAt) }
}

/**
 * Cron job: sends the next reminder for every overdue, unpaid document across all
 * orgs. Uses the service role. Returns how many reminders were created.
 */
export async function runReminders(): Promise<{ sent: number }> {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: overdue } = await admin
    .from("documents")
    .select("id")
    .in("status", ["issued", "sent", "partially_paid", "overdue"])
    .not("due_date", "is", null)
    .lt("due_date", today)

  let sent = 0
  for (const d of overdue ?? []) {
    const res = await createReminderForDocument(admin, d.id)
    if (res.ok) sent++
  }
  return { sent }
}
