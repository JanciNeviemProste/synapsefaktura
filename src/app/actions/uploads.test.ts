import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  FakeStorage,
  fakeDb,
  pngBytes,
  pdfBytes,
  type FakeDbOptions,
} from "@/test/fake-supabase"

/**
 * Testy priameho nahrávania do úložiska.
 *
 * Overujú presne to, čo pri obídení servera hrozí: že si klient určí cestu,
 * že cez lístok siahne do cudzej firmy, alebo že v buckete zostane súbor,
 * ktorý neprešiel kontrolou. Model ani sieť tu nefigurujú.
 */

const storage = new FakeStorage()
let db = fakeDb()

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => storage.client(),
}))
vi.mock("@/lib/auth/current-org", () => ({
  getCurrentOrgId: async () => currentOrg,
}))

let currentOrg: string | null = "org-1"

function setup(options: FakeDbOptions = {}) {
  db = fakeDb(options)
}

beforeEach(() => {
  storage.files.clear()
  storage.signed = []
  storage.buckets = ["attachments"]
  currentOrg = "org-1"
  setup()
})

const { createUploadTicket, verifyUpload } =
  await import("@/app/actions/uploads")

describe("createUploadTicket", () => {
  it("vydá lístok na cestu pod firmou volajúceho", async () => {
    const res = await createUploadTicket("attachment", "blocek.jpg", 1000)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.path.startsWith("org-1/expenses/")).toBe(true)
    expect(res.path.endsWith("blocek.jpg")).toBe(true)
    expect(res.token).toBeTruthy()
  })

  it("cestu určuje server, nie názov súboru", async () => {
    // Klasický pokus o vybočenie z priečinka. Lomky sa musia stratiť, inak by
    // sa dal lístok vydať na cudziu cestu.
    const res = await createUploadTicket(
      "branding",
      "../../org-2/logo.png",
      1000,
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.path.startsWith("org-1/branding/")).toBe(true)
    expect(res.path).not.toContain("/../")
    expect(res.path).not.toContain("org-2/")
  })

  it("bez firmy lístok nevydá", async () => {
    currentOrg = null
    const res = await createUploadTicket("attachment", "a.jpg", 10)
    expect(res.ok).toBe(false)
    expect(storage.signed).toHaveLength(0)
  })

  it("bez prihlásenia lístok nevydá", async () => {
    setup({ userId: null })
    const res = await createUploadTicket("attachment", "a.jpg", 10)
    expect(res.ok).toBe(false)
    expect(storage.signed).toHaveLength(0)
  })

  it("logo a podpis nesmie meniť radový člen", async () => {
    setup({ role: "member" })
    const res = await createUploadTicket("branding", "logo.png", 1000)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("vlastník")
    expect(storage.signed).toHaveLength(0)
  })

  it("prílohu nákladu smie nahrať aj radový člen", async () => {
    // Zámerný rozdiel: doklad zadáva ten, kto ho má — podobu faktúr nemení.
    setup({ role: "member" })
    const res = await createUploadTicket("attachment", "faktura.pdf", 1000)
    expect(res.ok).toBe(true)
  })

  it("priveľký súbor odmietne ešte pred nahratím", async () => {
    const res = await createUploadTicket(
      "attachment",
      "video.mp4",
      99 * 1024 * 1024,
    )
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toMatch(/MB/)
    expect(storage.signed).toHaveLength(0)
  })

  it("obrázok firmy má prísnejší strop než príloha", async () => {
    const big = 20 * 1024 * 1024
    expect((await createUploadTicket("branding", "logo.png", big)).ok).toBe(
      false,
    )
    expect((await createUploadTicket("attachment", "sken.pdf", big)).ok).toBe(
      true,
    )
  })

  it("chýbajúci bucket si vytvorí sám", async () => {
    storage.buckets = []
    const res = await createUploadTicket("attachment", "a.jpg", 10)
    expect(res.ok).toBe(true)
    expect(storage.buckets).toContain("attachments")
  })

  it("súbežné prvé nahratie nezhodí „už existuje“", async () => {
    // Produkcia bucket zatiaľ nemá, takže dvaja naraz pri PRVOM použití sú
    // najpravdepodobnejší prípad. Zoznam ho ešte nevidí, vytvorenie zlyhá.
    storage.buckets = []
    const listBuckets = async () => ({ data: [], error: null })
    const base = storage.client()
    const racing = { storage: { ...base.storage, listBuckets } }
    vi.spyOn(storage, "client").mockReturnValueOnce(
      racing as ReturnType<typeof storage.client>,
    )
    storage.buckets = ["attachments"] // medzitým ho vytvoril niekto iný

    const res = await createUploadTicket("attachment", "a.jpg", 10)
    expect(res.ok).toBe(true)
  })
})

describe("verifyUpload", () => {
  it("na cudziu cestu sa nepozrie", async () => {
    storage.put("org-2/branding/logo.png", pngBytes())
    const res = await verifyUpload("branding", "org-2/branding/logo.png")
    expect(res.ok).toBe(false)
    // A hlavne: súbor druhej firmy sa nesmie ani dotknúť.
    expect(storage.has("org-2/branding/logo.png")).toBe(true)
  })

  it("potvrdí nahraté logo", async () => {
    storage.put("org-1/branding/logo.png", pngBytes(120))
    const res = await verifyUpload("branding", "org-1/branding/logo.png")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.size).toBe(120)
    expect(res.mime).toBe("image/png")
  })

  it("nahraté PDF ako logo odmietne A ZMAŽE", async () => {
    // Bez zmazania by v buckete zostal súbor, na ktorý sa už nikto neodkáže.
    const path = "org-1/branding/logo.png"
    storage.put(path, pdfBytes())
    const res = await verifyUpload("branding", path)
    expect(res.ok).toBe(false)
    expect(storage.has(path)).toBe(false)
  })

  it("priveľký súbor po nahratí zmaže", async () => {
    // Veľkosť hlásená klientom nezaväzuje — skutočná sa zisťuje až tu.
    const path = "org-1/branding/logo.png"
    storage.put(path, pngBytes(9 * 1024 * 1024))
    const res = await verifyUpload("branding", path)
    expect(res.ok).toBe(false)
    expect(storage.has(path)).toBe(false)
  })

  it("prílohu nekontroluje na obrázok — PDF prejde", async () => {
    const path = "org-1/expenses/faktura.pdf"
    storage.put(path, pdfBytes())
    const res = await verifyUpload("attachment", path)
    expect(res.ok).toBe(true)
    expect(storage.has(path)).toBe(true)
  })

  it("neexistujúcu cestu hlási ako nenájdenú", async () => {
    const res = await verifyUpload("attachment", "org-1/expenses/nic.pdf")
    expect(res.ok).toBe(false)
  })

  it("bez firmy nepustí nikam", async () => {
    currentOrg = null
    storage.put("org-1/expenses/a.pdf", pdfBytes())
    const res = await verifyUpload("attachment", "org-1/expenses/a.pdf")
    expect(res.ok).toBe(false)
  })
})
