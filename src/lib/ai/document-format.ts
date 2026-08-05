/**
 * Rozpoznanie formátu dokladu pre AI vyťaženie (čisté, bez I/O).
 *
 * PREČO NESTAČÍ `file.type`: doteraz sa modelu posielal MIME typ presne tak,
 * ako ho nahlásil prehliadač. Keď bol prázdny (bežné pri zdieľaní súboru
 * z Androidu alebo drag&drop bez prípony), poslalo sa
 * `application/octet-stream`, model vrátil 400 a používateľ videl len
 * „AI volanie zlyhalo." — hláška, ktorá s príčinou nesúvisí.
 *
 * Formát sa preto určuje z OBSAHU. To isté už robí `lib/images/validate.ts`
 * pre logo; tu je zoznam širší, lebo model zvláda viac než PDF renderer.
 */

/** Formáty, ktoré Gemini prijme na vstupe. */
export type DocumentMime =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/heic"
  | "image/heif"
  | "application/pdf"

export type FormatCheck =
  | { ok: true; mime: DocumentMime }
  | { ok: false; error: string }

function starts(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false
  return sig.every((b, i) => bytes[offset + i] === b)
}

/** ASCII značka na danej pozícii — pre kontajnery ako WebP a HEIC. */
function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/** Formát podľa magických bajtov, alebo `null` keď ho nepoznáme. */
export function sniffDocumentMime(bytes: Uint8Array): DocumentMime | null {
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png"
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf" // %PDF
  // RIFF....WEBP
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "image/webp"
  // ....ftypheic / ftypheix / ftypmif1 / ftypmsf1 — ISO-BMFF kontajner
  if (ascii(bytes, 4, "ftyp")) {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase()
    if (brand === "heic" || brand === "heix") return "image/heic"
    if (brand === "mif1" || brand === "msf1" || brand === "heim")
      return "image/heif"
  }
  return null
}

/**
 * Overí, či sa dá súbor poslať modelu, a inak povie PREČO a čo s tým.
 *
 * Hláška je určená používateľovi so smartfónom v ruke, nie vývojárovi —
 * „AI volanie zlyhalo" mu nepovie nič.
 */
export function checkDocumentFormat(bytes: Uint8Array): FormatCheck {
  if (bytes.length === 0) {
    return { ok: false, error: "Súbor je prázdny." }
  }

  const mime = sniffDocumentMime(bytes)
  if (mime) return { ok: true, mime }

  // Časté omyly pomenujeme adresne — používateľ tak vie, čo urobiť.
  if (ascii(bytes, 0, "PK")) {
    return {
      ok: false,
      error:
        "Toto je zošit alebo archív, nie doklad. Nahraj fotku, sken alebo PDF.",
    }
  }
  if (ascii(bytes, 0, "%!PS") || ascii(bytes, 0, "II*") || ascii(bytes, 0, "MM")) {
    return {
      ok: false,
      error: "Formát TIFF/PostScript nepodporujeme. Ulož doklad ako PDF alebo JPEG.",
    }
  }

  return {
    ok: false,
    error:
      "Tento formát nevieme prečítať. Použi fotku (JPEG, PNG, HEIC), sken alebo PDF.",
  }
}
