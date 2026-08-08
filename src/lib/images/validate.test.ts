import { describe, it, expect } from "vitest"
import { imageMime, checkImage, MAX_IMAGE_BYTES } from "@/lib/images/validate"

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])
// "RIFF....WEBP" — presne ten pripad, ktory pdfkit nevie vlozit.
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
)

describe("imageMime", () => {
  it("rozpozna PNG a JPEG podla magickych bajtov", () => {
    expect(imageMime(PNG)).toBe("image/png")
    expect(imageMime(JPEG)).toBe("image/jpeg")
  })

  it("odmietne format, ktory pdfkit nevie vlozit", () => {
    expect(imageMime(WEBP)).toBeNull()
    expect(imageMime(SVG)).toBeNull()
  })

  it("nespadne na prilis kratkom vstupe", () => {
    expect(imageMime(new Uint8Array([0x89]))).toBeNull()
    expect(imageMime(new Uint8Array([]))).toBeNull()
  })

  it("nenecha sa oklamat spravnou priponou pri zlom obsahu", () => {
    // Premenovany .webp na .png ma stale magicke bajty WEBP.
    expect(imageMime(WEBP)).toBeNull()
  })
})

describe("checkImage", () => {
  it("pusti PNG aj JPEG", () => {
    expect(checkImage(PNG)).toEqual({ ok: true, mime: "image/png" })
    expect(checkImage(JPEG)).toEqual({ ok: true, mime: "image/jpeg" })
  })

  it("odmietne prazdny subor", () => {
    const res = checkImage(new Uint8Array([]))
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("prázdny")
  })

  it("odmietne prilis velky obrazok a povie kolko ma aj kolko smie", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1)
    big.set(PNG)
    const res = checkImage(big)
    expect(res.ok).toBe(false)
    if (res.ok) return
    const limitMb = Math.round(MAX_IMAGE_BYTES / (1024 * 1024))
    // Hlaska musi drzat krok s limitom — inak by po jeho zmene klamala.
    expect(res.error).toContain(`najviac ${limitMb} MB`)
    expect(res.error).toMatch(/\d+[.,]\d MB/)
  })

  it("presne na hranici este prejde", () => {
    const exact = new Uint8Array(MAX_IMAGE_BYTES)
    exact.set(PNG)
    expect(checkImage(exact).ok).toBe(true)
  })

  it("pri nepodporovanom formate vymenuje, co nefunguje", () => {
    const res = checkImage(WEBP)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("PNG")
    expect(res.error).toContain("WebP")
  })

  it("velkost sa kontroluje PRED formatom", () => {
    // Velky WebP ma dostat hlasku o velkosti — je to prva vec, ktoru ma
    // pouzivatel opravit, a hlaska o formate by ho poslala zlym smerom.
    const bigWebp = new Uint8Array(MAX_IMAGE_BYTES + 1)
    bigWebp.set(WEBP)
    const res = checkImage(bigWebp)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("MB")
  })
})
