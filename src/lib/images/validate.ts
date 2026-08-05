/**
 * Overenie firemných obrázkov (logo, podpis, pečiatka) — čisté, bez I/O.
 *
 * Pravidlá žijú tu, aby ich POUŽÍVALI OBE STRANY: upload aj generovanie PDF.
 * Kým existovali len pri renderi, používateľ mohol nahrať 5 MB WebP, dostal
 * „nahraté" a logo mu na faktúre nikdy nevyšlo — bez akéhokoľvek vysvetlenia.
 * Čo prejde uploadom, sa musí zaručene vykresliť.
 */

// Limit zije v `lib/upload/limits.ts` spolu s ostatnymi — aby sa nedal zmenit
// na jednom mieste a zabudnut na druhom. Reexport, aby volajuci nemuseli
// vediet, odkial pochadza.
import { MAX_IMAGE_BYTES as IMAGE_LIMIT } from "@/lib/upload/limits"

export { MAX_IMAGE_BYTES } from "@/lib/upload/limits"

export type ImageMime = "image/png" | "image/jpeg"

/**
 * Rozpozná formát podľa magických bajtov, NIE podľa hlavičky `content-type`.
 *
 * Storage vie vrátiť `application/octet-stream`, a naopak pri podvrhnutom
 * content-type by sa do PDF dostal SVG alebo WebP, ktoré pdfkit nevie vložiť
 * a vyhodil by výnimku uprostred renderu — teda pri generovaní dokladu, ktorý
 * sa vzápätí prikladá k odosielanej faktúre.
 */
export function imageMime(bytes: Uint8Array): ImageMime | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png"
  }
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg"
  }
  return null
}

export type ImageCheck =
  | { ok: true; mime: ImageMime }
  | { ok: false; error: string }

/**
 * Prejde obrázok uploadom? Hláška je určená používateľovi, takže hovorí, čo
 * s tým — nie „neplatný formát".
 */
export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) {
    return { ok: false, error: "Súbor je prázdny." }
  }
  if (bytes.length > IMAGE_LIMIT) {
    const mb = (bytes.length / (1024 * 1024)).toFixed(1)
    return {
      ok: false,
      error: `Obrázok má ${mb} MB, povolených je najviac ${Math.round(IMAGE_LIMIT / (1024 * 1024))} MB. Zmenši ho a skús znova.`,
    }
  }
  const mime = imageMime(bytes)
  if (!mime) {
    return {
      ok: false,
      error:
        "Podporujeme len PNG a JPEG. Iné formáty (napr. WebP, SVG, HEIC) sa do PDF nedajú vložiť.",
    }
  }
  return { ok: true, mime }
}
