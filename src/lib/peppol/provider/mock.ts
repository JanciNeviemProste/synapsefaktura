import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { isValidPeppolId } from "@/lib/peppol/id"
import type {
  DigitalPostmanProvider,
  EinvoiceTransportStatus,
  InboundMessage,
  ParticipantLookup,
  SendResult,
} from "@/lib/peppol/types"

/**
 * Sandbox transport that simulates a certified Digitálny poštár (Peppol Access
 * Point) for the 2026 voluntary/test window. It is **DB-backed for loopback**:
 * `send` simply acknowledges delivery (the calling action persists the outbound
 * `einvoices` row with the returned message id), and `receive` mirrors any
 * outbound message addressed to the caller's own Peppol id back as inbound —
 * which lets the §8 acceptance test (send → receive → expense) run end-to-end
 * with no external account.
 *
 * A real provider is a drop-in implementation of `DigitalPostmanProvider` that
 * calls the certified AP's HTTP API instead of this loopback.
 *
 * PRECO TU NIE JE `organization_id` FILTER, hoci sa pouziva service role:
 * scoping tu drzi `receiver_peppol_id`. Peppol ID slovenskeho subjektu ma tvar
 * `0245:<DIC>` a DIC je unikatne — takze filter na prijemcu JE filter na firmu,
 * len inym klucom. Pridanie `organization_id` by navyse rozbilo loopback: pri
 * nom je odosielatel ina organizacia nez prijemca, co je cely zmysel testu.
 *
 * Realny provider tuto uvahu nededi — ten dostava spravy zvonku a musi si
 * prijemcu overit sam.
 */
export class MockPostmanProvider implements DigitalPostmanProvider {
  readonly name = "mock"

  async send(
    _xml: string,
    _route: { senderPeppolId: string; receiverPeppolId: string },
  ): Promise<SendResult> {
    // The sandbox accepts and "delivers" immediately. The action records the
    // outbound einvoices row (with this id) so receive() can loop it back.
    return {
      messageId: `mock-${crypto.randomUUID()}`,
      transportStatus: "delivered",
    }
  }

  async receive(receiverPeppolId: string): Promise<InboundMessage[]> {
    const admin = createAdminClient()

    // Outbound messages addressed to me (across the local instance — loopback).
    const { data: outbound, error } = await admin
      .from("einvoices")
      .select(
        "peppol_message_id, sender_peppol_id, receiver_peppol_id, ubl_xml",
      )
      .eq("direction", "outbound")
      .eq("receiver_peppol_id", receiverPeppolId)
      .in("transport_status", ["sent", "delivered"])
      .not("ubl_xml", "is", null)

    if (error || !outbound?.length) return []

    // Drop any already mirrored into an inbound row (idempotent polling).
    const { data: seen } = await admin
      .from("einvoices")
      .select("peppol_message_id")
      .eq("direction", "inbound")
      .eq("receiver_peppol_id", receiverPeppolId)

    const seenIds = new Set(
      (seen ?? []).map((r) => r.peppol_message_id).filter(Boolean),
    )

    return outbound
      .filter((m) => m.peppol_message_id && !seenIds.has(m.peppol_message_id))
      .map((m) => ({
        messageId: m.peppol_message_id as string,
        senderPeppolId: m.sender_peppol_id,
        receiverPeppolId: m.receiver_peppol_id,
        xml: m.ubl_xml as string,
      }))
  }

  async status(messageId: string): Promise<EinvoiceTransportStatus> {
    const admin = createAdminClient()
    const { data } = await admin
      .from("einvoices")
      .select("transport_status")
      .eq("peppol_message_id", messageId)
      .maybeSingle()
    return data?.transport_status ?? "delivered"
  }

  async lookupParticipant(peppolId: string): Promise<ParticipantLookup> {
    // Sandbox SML: any well-formed participant id is considered reachable.
    return { found: isValidPeppolId(peppolId) }
  }
}
