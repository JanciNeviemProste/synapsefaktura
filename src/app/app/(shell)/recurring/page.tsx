import { createClient } from "@/lib/supabase/server"
import { RecurringView } from "@/components/recurring/recurring-view"

export const metadata = { title: "Pravidelné faktúry — Synapse Faktúra" }

export default async function RecurringPage() {
  const supabase = await createClient()
  const [{ data: recurring }, { data: contacts }] = await Promise.all([
    supabase
      .from("recurring_invoices")
      .select("*, contacts(name)")
      .order("next_run_at"),
    supabase.from("contacts").select("id, name").order("name"),
  ])

  return <RecurringView recurring={recurring ?? []} contacts={contacts ?? []} />
}
