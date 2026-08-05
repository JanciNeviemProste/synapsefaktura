"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { ATTACHMENTS_BUCKET, BRANDING_PREFIX } from "@/lib/storage/buckets"
import {
  MAX_ATTACHMENT_BYTES,
  MAX_IMAGE_BYTES,
  tooLargeMessage,
} from "@/lib/upload/limits"

/**
 * Priame nahrávanie do úložiska.
 *
 * PREČO: čokoľvek poslané cez Server Action prechádza serverovou funkciou
 * Vercelu a tá má **tvrdý strop 4,5 MB na telo požiadavky**. Ten sa nedá
 * zvýšiť nastavením — bežná fotka bločka z mobilu sa cezeň jednoducho
 * nedostane.
 *
 * Riešenie: server vydá **podpísaný lístok** na konkrétnu cestu, prehliadač
 * pošle súbor priamo do Supabase Storage a server sa ho potom spýta, čo tam
 * pristálo. Súbor sa tak servera vôbec nedotkne a platí len limit úložiska.
 *
 * Bezpečnosť tým netrpí:
 * - lístok vydá server až po overení prihlásenia, firmy a role,
 * - cesta pochádza VÝHRADNE zo servera (`{orgId}/…`), klient ju neurčuje,
 * - lístok platí na jednu cestu, takže sa ním nedá prepísať cudzí súbor,
 * - obsah sa overuje AŽ PO nahratí (magické bajty aj skutočná veľkosť),
 *   takže deklarovaný typ z prehliadača nikoho nezaväzuje.
 */

export type UploadTicket =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string }

export type UploadKind = "attachment" | "branding"

/** Názov súboru na bezpečný tvar — cesta pochádza zo servera, nie od klienta. */
function safeName(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, "_").slice(-80)
  return cleaned === "" ? "subor" : cleaned
}

/**
 * Vydá lístok na nahratie. `size` je len na skorú a zrozumiteľnú hlášku —
 * skutočná veľkosť sa overí až po nahratí, lebo klientovi sa veriť nedá.
 */
export async function createUploadTicket(
  kind: UploadKind,
  fileName: string,
  size: number,
): Promise<UploadTicket> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Nie si prihlásený." }

  const limit = kind === "branding" ? MAX_IMAGE_BYTES : MAX_ATTACHMENT_BYTES
  if (size > limit) {
    return { ok: false, error: tooLargeMessage(size, limit) }
  }

  // Branding mení podobu dokladov firmy — to nie je vec pre hocijakého člena.
  // Príloha nákladu áno, tam guard zámerne nie je.
  if (kind === "branding") {
    const { data: me } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (me?.role !== "owner" && me?.role !== "admin") {
      return {
        ok: false,
        error: "Firemné údaje môže meniť len vlastník alebo administrátor.",
      }
    }
  }

  const folder = kind === "branding" ? BRANDING_PREFIX : "expenses"
  const path = `${orgId}/${folder}/${Date.now()}-${safeName(fileName)}`

  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === ATTACHMENTS_BUCKET)) {
    const { error } = await admin.storage.createBucket(ATTACHMENTS_BUCKET, {
      public: false,
    })
    if (error) return { ok: false, error: "Úložisko sa nepodarilo pripraviť." }
  }

  const { data, error } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) {
    return { ok: false, error: "Nahrávanie sa nepodarilo pripraviť." }
  }

  return { ok: true, path: data.path, token: data.token }
}

export type UploadedFile =
  | { ok: true; path: string; size: number; mime: string | null }
  | { ok: false; error: string }

/**
 * Overí, čo sa do úložiska naozaj nahralo.
 *
 * Bez tohto kroku by priame nahrávanie znamenalo, že do úložiska ide obsah,
 * ktorý server nikdy nevidel. Preto sa súbor stiahne späť a skontroluje —
 * a keď neprejde, hneď sa aj zmaže, aby po ňom nezostalo smetie.
 */
export async function verifyUpload(
  kind: UploadKind,
  path: string,
): Promise<UploadedFile> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // Prefix organizácie je to, čo bráni siahnuť na cudzí súbor.
  if (!path.startsWith(`${orgId}/`)) {
    return { ok: false, error: "Súbor sa nenašiel." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .download(path)
  if (error || !data) return { ok: false, error: "Súbor sa nenašiel." }

  const bytes = new Uint8Array(await data.arrayBuffer())
  const limit = kind === "branding" ? MAX_IMAGE_BYTES : MAX_ATTACHMENT_BYTES

  if (bytes.length > limit) {
    await admin.storage.from(ATTACHMENTS_BUCKET).remove([path])
    return { ok: false, error: tooLargeMessage(bytes.length, limit) }
  }

  if (kind === "branding") {
    const { checkImage } = await import("@/lib/images/validate")
    const check = checkImage(bytes)
    if (!check.ok) {
      await admin.storage.from(ATTACHMENTS_BUCKET).remove([path])
      return { ok: false, error: check.error }
    }
    return { ok: true, path, size: bytes.length, mime: check.mime }
  }

  return { ok: true, path, size: bytes.length, mime: data.type || null }
}
