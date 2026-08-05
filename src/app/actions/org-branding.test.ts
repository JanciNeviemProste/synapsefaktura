import { describe, it, expect, vi, beforeEach } from "vitest"
import { FakeStorage, fakeDb, pngBytes, type FakeDbOptions } from "@/test/fake-supabase"

/**
 * Testy zápisu loga, podpisu a pečiatky firmy.
 *
 * Súbor sem prichádza už nahratý priamo do úložiska, takže akcia zodpovedá za
 * tri veci a každá z nich má svoju cenu: aby cesta patrila firme volajúceho,
 * aby po neúspešnom zápise nezostal v buckete sirotinec, a aby sa staré logo
 * po výmene nehromadilo navždy.
 */

const storage = new FakeStorage()
let db = fakeDb()
let currentOrg: string | null = "org-1"

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => storage.client(),
}))
vi.mock("@/lib/auth/current-org", () => ({
  getCurrentOrgId: async () => currentOrg,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/navigation", () => ({ redirect: () => {} }))

function setup(options: FakeDbOptions = {}) {
  db = fakeDb(options)
}

beforeEach(() => {
  storage.files.clear()
  currentOrg = "org-1"
  setup()
})

const { setBrandingImage } = await import("@/app/actions/org")

const NEW = "org-1/branding/1754000000000-logo.png"

describe("setBrandingImage", () => {
  it("zapíše logo a súbor v úložisku nechá", async () => {
    storage.put(NEW, pngBytes())
    const res = await setBrandingImage("logo", NEW)
    expect(res.ok).toBe(true)
    expect(storage.has(NEW)).toBe(true)
    expect(db.writes.at(-1)?.values).toEqual({ logo_url: NEW })
  })

  it("podpis a pečiatka idú do vlastných stĺpcov", async () => {
    storage.put(NEW, pngBytes())
    await setBrandingImage("signature", NEW)
    expect(db.writes.at(-1)?.values).toEqual({ signature_url: NEW })

    setup()
    await setBrandingImage("stamp", NEW)
    expect(db.writes.at(-1)?.values).toEqual({ stamp_url: NEW })
  })

  it("cudziu cestu odmietne a nič nezapíše", async () => {
    const foreign = "org-2/branding/logo.png"
    storage.put(foreign, pngBytes())
    const res = await setBrandingImage("logo", foreign)
    expect(res.ok).toBe(false)
    expect(db.writes).toHaveLength(0)
    expect(storage.has(foreign)).toBe(true)
  })

  it("radový člen podobu dokladov nemení", async () => {
    setup({ role: "member" })
    storage.put(NEW, pngBytes())
    const res = await setBrandingImage("logo", NEW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("vlastník")
    expect(db.writes).toHaveLength(0)
  })

  it("po neúspešnom zápise upratá nahratý súbor", async () => {
    // Zápis odfiltrovaný cez RLS vráti 204 bez chyby — bez `writeOutcome` by
    // sa akcia tvárila úspešne a súbor by v buckete zostal navždy.
    setup({ updateBlocked: true })
    storage.put(NEW, pngBytes())
    const res = await setBrandingImage("logo", NEW)
    expect(res.ok).toBe(false)
    expect(storage.has(NEW)).toBe(false)
  })

  it("staré logo po výmene zmaže", async () => {
    const old = "org-1/branding/1753000000000-stare.png"
    setup({ organization: { logo_url: old, signature_url: null, stamp_url: null } })
    storage.put(old, pngBytes())
    storage.put(NEW, pngBytes())

    const res = await setBrandingImage("logo", NEW)
    expect(res.ok).toBe(true)
    expect(storage.has(old)).toBe(false)
    expect(storage.has(NEW)).toBe(true)
  })

  it("pri výmene loga sa podpisu nedotkne", async () => {
    const signature = "org-1/branding/podpis.png"
    setup({
      organization: { logo_url: null, signature_url: signature, stamp_url: null },
    })
    storage.put(signature, pngBytes())
    storage.put(NEW, pngBytes())

    await setBrandingImage("logo", NEW)
    expect(storage.has(signature)).toBe(true)
  })

  it("rovnakú cestu nezmaže sama sebe", async () => {
    setup({ organization: { logo_url: NEW, signature_url: null, stamp_url: null } })
    storage.put(NEW, pngBytes())
    const res = await setBrandingImage("logo", NEW)
    expect(res.ok).toBe(true)
    expect(storage.has(NEW)).toBe(true)
  })

  it("staré logo zadané ako odkaz sa mazať nepokúša", async () => {
    // Staršie firmy majú v stĺpci celú adresu, nie cestu v našom úložisku.
    setup({
      organization: {
        logo_url: "https://cdn.priklad.sk/logo.png",
        signature_url: null,
        stamp_url: null,
      },
    })
    storage.put(NEW, pngBytes())
    const res = await setBrandingImage("logo", NEW)
    expect(res.ok).toBe(true)
    expect(storage.has(NEW)).toBe(true)
  })

  it("bez firmy nezapíše nič", async () => {
    currentOrg = null
    storage.put(NEW, pngBytes())
    const res = await setBrandingImage("logo", NEW)
    expect(res.ok).toBe(false)
    expect(db.writes).toHaveLength(0)
  })
})
