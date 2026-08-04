import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { RecurringView } from "@/components/recurring/recurring-view"

export const metadata = { title: "Pravidelné faktúry — Synapse Faktúra" }

export default async function RecurringPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez organizacie nie je co zobrazit — vykreslime prazdny stav
  if (!orgId) {
    return <RecurringView recurring={[]} contacts={[]} />
  }

  const [{ data: recurring }, { data: contacts }] = await Promise.all([
    supabase
      .from("recurring_invoices")
      .select("*, contacts(name)")
      .eq("organization_id", orgId)
      .order("next_run_at"),
    supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name"),
  ])

  return <RecurringView recurring={recurring ?? []} contacts={contacts ?? []} />
}
