import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Cron job: flip issued/sent invoices past their due date to `overdue`.
 * Partially-paid invoices keep their status (still actionable elsewhere).
 */
export async function runOverdue(): Promise<{ updated: number }> {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await admin
    .from("documents")
    .update({ status: "overdue" })
    .in("status", ["issued", "sent"])
    .not("due_date", "is", null)
    .lt("due_date", today)
    .select("id")
  return { updated: data?.length ?? 0 }
}
