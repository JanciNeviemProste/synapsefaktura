import { describe, it, expect } from "vitest"
import {
  sniffDocumentMime,
  checkDocumentFormat,
} from "@/lib/ai/document-format"

const bytes = (...v: number[]) => new Uint8Array(v)
const withAscii = (offset: number, text: string, len = 32) => {
  const b = new Uint8Array(len)
  for (let i = 0; i < text.length; i++) b[offset + i] = text.charCodeAt(i)
  return b
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34)

function webp() {
  const b = withAscii(0, "RIFF")
  const w = withAscii(8, "WEBP")
  b.set(w.slice(8, 12), 8)
  return b
}
function heicLike(brand: string) {
  const b = withAscii(4, "ftyp")
  for (let i = 0; i < brand.length; i++) b[8 + i] = brand.charCodeAt(i)
  return b
}

describe("sniffDocumentMime", () => {
  it("rozpozna formaty, ktore model prijme", () => {
    expect(sniffDocumentMime(PNG)).toBe("image/png")
    expect(sniffDocumentMime(JPEG)).toBe("image/jpeg")
    expect(sniffDocumentMime(PDF)).toBe("application/pdf")
    expect(sniffDocumentMime(webp())).toBe("image/webp")
  })

  it("rozpozna HEIC z iPhonu", () => {
    // Presne ten pripad, ktory doteraz koncil hlaskou „AI volanie zlyhalo".
    expect(sniffDocumentMime(heicLike("heic"))).toBe("image/heic")
    expect(sniffDocumentMime(heicLike("heix"))).toBe("image/heic")
    expect(sniffDocumentMime(heicLike("mif1"))).toBe("image/heif")
  })

  it("nepozna nezmysel", () => {
    expect(sniffDocumentMime(bytes(1, 2, 3, 4, 5, 6, 7, 8))).toBeNull()
    expect(sniffDocumentMime(bytes())).toBeNull()
  })

  it("nespadne na kratkom vstupe", () => {
    expect(sniffDocumentMime(bytes(0x89))).toBeNull()
    expect(sniffDocumentMime(bytes(0xff, 0xd8))).toBeNull()
  })
})

describe("checkDocumentFormat", () => {
  it("pusti fotku aj PDF", () => {
    expect(checkDocumentFormat(JPEG)).toEqual({ ok: true, mime: "image/jpeg" })
    expect(checkDocumentFormat(PDF)).toEqual({
      ok: true,
      mime: "application/pdf",
    })
  })

  it("HEIC prejde — model ho zvlada", () => {
    expect(checkDocumentFormat(heicLike("heic")).ok).toBe(true)
  })

  it("prazdny subor odmietne", () => {
    const r = checkDocumentFormat(bytes())
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain("prázdny")
  })

  it("zosit Excelu pomenuje adresne, nie ako 'neznamy format'", () => {
    // Pouzivatel omylom nahra tabulku — hlaska mu ma povedat, co s tym.
    const r = checkDocumentFormat(withAscii(0, "PK"))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain("zošit")
  })

  it("neznamy format povie, co pouzit", () => {
    const r = checkDocumentFormat(bytes(1, 2, 3, 4, 5, 6, 7, 8))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain("JPEG")
    expect(r.error).toContain("PDF")
  })
})
