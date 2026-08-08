import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { checkImage, MAX_IMAGE_BYTES } from "@/lib/images/validate"
import { ATTACHMENTS_BUCKET } from "@/lib/storage/buckets"

/** Rozpocet na stiahnutie jedneho firemneho obrazka (logo/podpis/peciatka). */
const IMAGE_TIMEOUT_MS = 2500

/**
 * Vrati obrazok ako data URI. Prijme dve podoby:
 *
 *  - `https://…`  — verejna adresa (starsie zaznamy, cudzi hosting),
 *  - `{orgId}/branding/…` — cesta v SUKROMNOM buckete `attachments`.
 *
 * Sukromne ulozisko je zamer, nie komplikacia: verejna URL na obrazok PODPISU
 * je navod na falsovanie. Preto sa subor stahuje service-role klientom priamo
 * tu — tento modul je `server-only`, takze sa do prehliadaca nedostane.
 *
 * Stahujeme tu a nie v @react-pdf/renderer: renderer by siahal na siet bez
 * timeoutu az pocas layoutu, takze nedostupny bucket by drzal generovanie PDF
 * — a to iste PDF sa priklada k odosielanej fakture (markAsSent). Kazde
 * zlyhanie preto konci ako `null` a doklad sa vykresli bez obrazka.
 *
 * `orgId` je POVINNE: service-role klient obchadza RLS aj Storage policies,
 * takze bez kontroly prefixu by sa dala stiahnut lubovolna cesta v buckete —
 * teda aj podpis alebo peciatka cudzej firmy. Ta ISTA kontrola je v uploads.ts,
 * org.ts, ai-capture.ts a expenses.ts; tu chybala.
 *
 * Preco vlastny modul a nie sucast render.tsx: render.tsx obsahuje JSX, takze
 * sa da otestovat len zo suboru, ktory JSX tiez povoluje — a tato funkcia je
 * jedina bezpecnostne kriticka cast celeho generovania PDF. Test ma byt
 * jednoduchy, nie zavisly na transformacii JSX.
 */
export async function imageDataUrl(
  pathOrUrl: string | null,
  orgId: string,
): Promise<string | null> {
  if (!pathOrUrl) return null
  try {
    let bytes: Buffer
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const res = await fetch(pathOrUrl, {
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        cache: "no-store",
      })
      if (!res.ok) return null
      const declared = Number(res.headers.get("content-length"))
      if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null
      bytes = Buffer.from(await res.arrayBuffer())
    } else {
      // Cesta musi lezat pod vlastnou organizaciou.
      if (!pathOrUrl.startsWith(`${orgId}/`)) return null
      const { data, error } = await createAdminClient()
        .storage.from(ATTACHMENTS_BUCKET)
        .download(pathOrUrl)
      if (error || !data) return null
      bytes = Buffer.from(await data.arrayBuffer())
    }

    // Ta ISTA kontrola ako pri uploade (lib/images/validate) — co preslo
    // nahravanim, sa musi dat aj vykreslit.
    const check = checkImage(bytes)
    if (!check.ok) return null
    return `data:${check.mime};base64,${bytes.toString("base64")}`
  } catch {
    return null
  }
}
