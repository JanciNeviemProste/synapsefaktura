import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { ContactsView } from "@/components/contacts/contacts-view"

export const metadata = { title: "Kontakty — Synapse Faktúra" }

export default async function ContactsPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez aktivnej organizacie nemame co zobrazit — prazdny stav riesi ContactsView.
  if (!orgId) return <ContactsView contacts={[]} />

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  return <ContactsView contacts={contacts ?? []} />
}
