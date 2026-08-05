import { createClient } from "@/lib/supabase/client"
import { ATTACHMENTS_BUCKET } from "@/lib/storage/buckets"
import {
  createUploadTicket,
  verifyUpload,
  type UploadKind,
} from "@/app/actions/uploads"

/**
 * Nahratie súboru z prehliadača PRIAMO do úložiska.
 *
 * Obchádza serverovú funkciu, ktorá má na Verceli tvrdý strop 4,5 MB na telo
 * požiadavky. Fotka bločka z mobilu sa cezeň nedostane; takto áno.
 *
 * Postup: server vydá podpísaný lístok → prehliadač pošle súbor priamo do
 * Supabase → server si overí, čo pristálo. Volajúci dostane len cestu.
 */
export type DirectUploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export async function uploadDirect(
  kind: UploadKind,
  file: File,
): Promise<DirectUploadResult> {
  const ticket = await createUploadTicket(kind, file.name, file.size)
  if (!ticket.ok) return ticket

  const supabase = createClient()
  const { error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, file, {
      contentType: file.type || undefined,
    })
  if (error) {
    return { ok: false, error: "Súbor sa nepodarilo nahrať. Skús to znova." }
  }

  // Overenie AZ TU: do uloziska islo nieco, co server nevidel. Ked to
  // neprejde, `verifyUpload` subor rovno zmaze.
  const verified = await verifyUpload(kind, ticket.path)
  if (!verified.ok) return verified

  return { ok: true, path: verified.path }
}
