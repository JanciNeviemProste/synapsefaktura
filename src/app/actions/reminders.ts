"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createReminderForDocument } from "@/lib/jobs/reminders"

/** Sends the next-level reminder for a document (from the document detail UI). */
export async function sendReminder(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const res = await createReminderForDocument(supabase, documentId)
  if (res.ok) {
    revalidatePath(`/app/invoices/${documentId}`)
  }
  return res
}
