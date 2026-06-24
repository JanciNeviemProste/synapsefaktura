import { listInbound } from "@/app/actions/einvoice-inbound"
import { InboxView } from "@/components/einvoice/inbox-view"

export const metadata = { title: "Prijaté e-faktúry — Synapse Faktúra" }

export default async function EinvoicesPage() {
  const rows = await listInbound()
  return <InboxView initial={rows} />
}
