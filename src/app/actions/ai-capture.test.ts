import { describe, it, expect, vi, beforeEach } from "vitest"
import { FakeStorage, fakeDb, pdfBytes } from "@/test/fake-supabase"
import type { ExtractedDocument } from "@/lib/ai/extractor"

/**
 * Testy vyťaženia bločka (OCR).
 *
 * Ťažisko je v tom, ČO SA STANE PRED MODELOM. Volanie modelu stojí peniaze
 * a jeho zlyhanie sa používateľovi ukazovalo ako „AI volanie zlyhalo." bez
 * ohľadu na príčinu — takže cudzia cesta, nepodporovaný formát a chýbajúca
 * firma sa musia zastaviť skôr, než sa token spáli.
 */

const storage = new FakeStorage()
let db = fakeDb()
let currentOrg: string | null = "org-1"

/** Čo dostal model — `null`, keď sa vôbec nezavolal. */
let seen: { mediaType: string; size: number } | null = null
let extractorResult: unknown = null

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => storage.client(),
}))
vi.mock("@/lib/auth/current-org", () => ({
  getCurrentOrgId: async () => currentOrg,
}))
vi.mock("@/lib/ai/rate-limit", () => ({
  checkAiRateLimit: async () => rateLimit,
}))
vi.mock("@/lib/ai/extractor", () => ({
  documentExtractor: {
    extract: async (file: { data: Uint8Array; mediaType: string }) => {
      seen = { mediaType: file.mediaType, size: file.data.length }
      return extractorResult
    },
  },
}))
vi.mock("@/app/actions/expenses", () => ({
  createExpense: async (input: unknown) => {
    created = input as Record<string, unknown>
    return { ok: true, id: "exp-1" }
  },
}))

let rateLimit: { ok: true } | { ok: false; error: string } = { ok: true }
let created: Record<string, unknown> | null = null

const doc = (over: Partial<ExtractedDocument> = {}): ExtractedDocument => ({
  supplierName: "Potraviny s.r.o.",
  supplierIco: "12345678",
  supplierIcDph: null,
  documentNumber: "B-1",
  issueDate: "2026-08-05",
  supplyDate: null,
  dueDate: null,
  currency: "EUR",
  iban: null,
  variableSymbol: null,
  subtotal: 100,
  vatTotal: 19,
  total: 119,
  vatRate: null,
  lines: [],
  confidence: 0.9,
  ...over,
})

beforeEach(() => {
  storage.files.clear()
  db = fakeDb()
  currentOrg = "org-1"
  seen = null
  created = null
  rateLimit = { ok: true }
  extractorResult = { ok: true, data: doc() }
})

const { extractFromStoredFile, confirmExpenseFromCapture } =
  await import("@/app/actions/ai-capture")

/** JPEG podľa magických bajtov — tak, ako príde fotka z mobilu. */
function jpeg(size = 512): Uint8Array {
  const b = new Uint8Array(size)
  b.set([0xff, 0xd8, 0xff, 0xe0], 0)
  return b
}
/** HEIC z iPhonu — kontajner ISO-BMFF so značkou `ftypheic`. */
function heic(size = 512): Uint8Array {
  const b = new Uint8Array(size)
  const tag = "ftypheic"
  for (let i = 0; i < tag.length; i++) b[4 + i] = tag.charCodeAt(i)
  return b
}
/** Zošit Excelu — ZIP, teda `PK`. Častý omyl pri nahrávaní. */
function xlsx(size = 512): Uint8Array {
  const b = new Uint8Array(size)
  b.set([0x50, 0x4b, 0x03, 0x04], 0)
  return b
}

describe("extractFromStoredFile", () => {
  it("vyťaží fotku bločka", async () => {
    storage.put("org-1/expenses/blocek.jpg", jpeg())
    const res = await extractFromStoredFile("org-1/expenses/blocek.jpg")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.parsed.supplierName).toBe("Potraviny s.r.o.")
    expect(seen?.mediaType).toBe("image/jpeg")
  })

  it("HEIC z iPhonu pošle modelu so správnym typom", async () => {
    // Doteraz išiel modelu typ nahlásený prehliadačom; pri HEIC býval prázdny
    // a volanie skončilo chybou, ktorá s príčinou nesúvisela.
    storage.put("org-1/expenses/IMG_0042.HEIC", heic())
    const res = await extractFromStoredFile("org-1/expenses/IMG_0042.HEIC")
    expect(res.ok).toBe(true)
    expect(seen?.mediaType).toBe("image/heic")
  })

  it("PDF faktúru pošle ako PDF", async () => {
    storage.put("org-1/expenses/f.pdf", pdfBytes())
    await extractFromStoredFile("org-1/expenses/f.pdf")
    expect(seen?.mediaType).toBe("application/pdf")
  })

  it("zošit Excelu model NEUVIDÍ a hláška povie prečo", async () => {
    storage.put("org-1/expenses/tabulka.xlsx", xlsx())
    const res = await extractFromStoredFile("org-1/expenses/tabulka.xlsx")
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("zošit")
    expect(seen).toBeNull() // token sa nespálil
  })

  it("na cudziu cestu nesiahne a model nezavolá", async () => {
    storage.put("org-2/expenses/blocek.jpg", jpeg())
    const res = await extractFromStoredFile("org-2/expenses/blocek.jpg")
    expect(res.ok).toBe(false)
    expect(seen).toBeNull()
  })

  it("bez firmy model nezavolá", async () => {
    currentOrg = null
    storage.put("org-1/expenses/blocek.jpg", jpeg())
    const res = await extractFromStoredFile("org-1/expenses/blocek.jpg")
    expect(res.ok).toBe(false)
    expect(seen).toBeNull()
  })

  it("pri vyčerpanom limite model nezavolá", async () => {
    rateLimit = { ok: false, error: "Priveľa volaní." }
    storage.put("org-1/expenses/blocek.jpg", jpeg())
    const res = await extractFromStoredFile("org-1/expenses/blocek.jpg")
    expect(res.ok).toBe(false)
    expect(seen).toBeNull()
  })

  it("chýbajúci súbor nahlási zrozumiteľne", async () => {
    const res = await extractFromStoredFile("org-1/expenses/nic.jpg")
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("nenašiel")
  })

  it("zlyhanie modelu prenesie aj s dôvodom pre paywall", async () => {
    extractorResult = {
      ok: false,
      degraded: false,
      error: "Táto funkcia je v tarife Pro.",
      reason: "gated",
      upgrade: "pro",
    }
    storage.put("org-1/expenses/blocek.jpg", jpeg())
    const res = await extractFromStoredFile("org-1/expenses/blocek.jpg")
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.upgrade).toBe("pro")
    expect(res.reason).toBe("gated")
  })
})

describe("confirmExpenseFromCapture", () => {
  it("sadzbu odvodí zo súm, keď ju model nevyťažil", async () => {
    // Potravinový bloček: 19 %. Predtým sa sem natvrdo dosadilo 23 %.
    await confirmExpenseFromCapture({ parsed: doc({ vatRate: null }) })
    expect(created?.vatRate).toBe(19)
  })

  it("keď sa sadzba odvodiť nedá, nechá nulu", async () => {
    await confirmExpenseFromCapture({
      parsed: doc({ vatRate: null, subtotal: 100, vatTotal: 42 }),
    })
    expect(created?.vatRate).toBe(0)
  })

  it("vyťaženú sadzbu neprepíše", async () => {
    await confirmExpenseFromCapture({ parsed: doc({ vatRate: 5 }) })
    expect(created?.vatRate).toBe(5)
  })

  it("položky z bločka sa nezahodia", async () => {
    // Bloček s dvomi sadzbami sa inak nedal zaevidovať správne.
    await confirmExpenseFromCapture({
      parsed: doc({
        vatRate: null,
        lines: [
          { description: "Chlieb", quantity: 2, unitPrice: 1.5, vatRate: 19 },
          { description: "Sáčok", quantity: 1, unitPrice: 0.1, vatRate: 23 },
        ],
      }),
    })
    const items = created?.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(2)
    expect(items[0].description).toBe("Chlieb")
    expect(items[0].vatRate).toBe(19)
    expect(items[1].vatRate).toBe(23)
  })

  it("bez položiek pošle náklad ako jednu sumu", async () => {
    await confirmExpenseFromCapture({ parsed: doc({ lines: [] }) })
    expect(created?.items).toBeUndefined()
    expect(created?.subtotal).toBe(100)
  })

  it("chýbajúci základ dopočíta z celkovej sumy a dane", async () => {
    await confirmExpenseFromCapture({
      parsed: doc({ subtotal: null, total: 119, vatTotal: 19 }),
    })
    expect(created?.subtotal).toBe(100)
  })
})
