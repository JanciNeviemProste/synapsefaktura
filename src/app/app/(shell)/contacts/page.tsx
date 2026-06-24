import { createClient } from "@/lib/supabase/server"
import { ContactsView } from "@/components/contacts/contacts-view"

export const metadata = { title: "Kontakty — Synapse Faktúra" }

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false })

  return <ContactsView contacts={contacts ?? []} />
}
