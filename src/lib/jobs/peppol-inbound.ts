import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPostmanProvider } from "@/lib/peppol/provider"
import type { InboundMessage } from "@/lib/peppol/types"

type Db = SupabaseClient<Database>

/**
 * Pull inbound Peppol messages for a single org and persist any new ones as
 * `direction: 'inbound'` einvoices rows. Idempotent: a message already stored
 * (same `peppol_message_id` + inbound direction) is skipped. Returns the count
 * of newly received messages. Shared by the cron job and the interactive
 * "check my inbox" action.
 */
export async function receiveInboundForOrg(
  db: Db,
  org: {
    id: string
    peppol_id: string
    digital_postman_provider: string | null
  },
): Promise<number> {
  const provider = getPostmanProvider(org.digital_postman_provider)
  const msgs: InboundMessage[] = await provider.receive(org.peppol_id)

  let received = 0
  for (const msg of msgs) {
    const { data: existing } = await db
      .from("einvoices")
      .select("id")
      .eq("peppol_message_id", msg.messageId)
      .eq("direction", "inbound")
      .maybeSingle()
    if (existing) continue

    const { error } = await db.from("einvoices").insert({
      organization_id: org.id,
      direction: "inbound",
      ubl_xml: msg.xml,
      peppol_message_id: msg.messageId,
      sender_peppol_id: msg.senderPeppolId,
      receiver_peppol_id: msg.receiverPeppolId,
      transport_status: "received",
      validation_status: "pending",
      provider: provider.name,
    })
    if (!error) received++
  }
  return received
}

/**
 * Cron job: pulls inbound Peppol documents for every e-invoice-enabled org with
 * a Peppol id, across all tenants (service role). Never throws — failures are
 * isolated per org so one bad provider call doesn't stop the rest.
 */
export async function runPeppolInbound(): Promise<{
  ok: boolean
  received: number
}> {
  const admin = createAdminClient()

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, peppol_id, digital_postman_provider")
    .eq("einvoice_enabled", true)
    .not("peppol_id", "is", null)

  let received = 0
  for (const org of orgs ?? []) {
    if (!org.peppol_id) continue
    try {
      received += await receiveInboundForOrg(admin, {
        id: org.id,
        peppol_id: org.peppol_id,
        digital_postman_provider: org.digital_postman_provider,
      })
    } catch {
      // Isolate per-org failures (provider down, network, etc.) and continue.
    }
  }

  return { ok: true, received }
}
