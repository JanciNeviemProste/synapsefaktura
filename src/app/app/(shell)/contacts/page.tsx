import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { listTags, taggedEntityIds, entityTagMap } from "@/app/actions/tags"
import { ContactsView } from "@/components/contacts/contacts-view"

export const metadata = { title: "Kontakty — Synapse Faktúra" }

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>
}) {
  const sp = await searchParams
  const activeTagId = typeof sp.tag === "string" ? sp.tag : null

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez aktivnej organizacie nemame co zobrazit — prazdny stav riesi ContactsView.
  if (!orgId) return <ContactsView contacts={[]} />

  const [tags, taggedIds] = await Promise.all([
    listTags(),
    taggedEntityIds("contact", activeTagId ?? undefined),
  ])

  // `taggedIds === null` znamena "bez filtra", `[]` znamena "nic nevyhovuje".
  let query = supabase.from("contacts").select("*").eq("organization_id", orgId)
  if (taggedIds) query = query.in("id", taggedIds)

  const { data: contacts } = await query.order("created_at", {
    ascending: false,
  })

  const rows = contacts ?? []
  const tagsByContact = await entityTagMap(
    "contact",
    rows.map((c) => c.id),
  )

  return (
    <ContactsView
      contacts={rows}
      tags={tags}
      tagsByContact={tagsByContact}
      activeTagId={activeTagId}
    />
  )
}
