/**
 * Obrazky do PDF sa stahuju SERVICE-ROLE klientom — ten obchadza RLS aj
 * Storage policies. Jedina vec, ktora tam brani stiahnut podpis alebo peciatku
 * cudzej firmy, je kontrola prefixu cesty. Tieto testy strazia prave ju.
 *
 * Vzor mockovania je rovnaky ako v `src/app/actions/uploads.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

/** Cesty, ktore sa realne dostali do `storage.download()`. */
let downloaded: string[] = []

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: async (path: string) => {
          downloaded.push(path)
          return {
            data: {
              arrayBuffer: async () => {
                // Najmensi obsah, ktory prejde cez checkImage ako PNG.
                const b = new Uint8Array(64)
                b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
                return b.buffer as ArrayBuffer
              },
            },
            error: null,
          }
        },
      }),
    },
  }),
}))

beforeEach(() => {
  downloaded = []
})

const { imageDataUrl } = await import("@/lib/pdf/image-data-url")

const ORG = "11111111-1111-1111-1111-111111111111"
const INY = "22222222-2222-2222-2222-222222222222"

describe("imageDataUrl — cesta v úložisku", () => {
  it("vlastné logo stiahne a vráti ako data URI", async () => {
    const res = await imageDataUrl(`${ORG}/branding/logo.png`, ORG)

    expect(res).toMatch(/^data:image\/png;base64,/)
    expect(downloaded).toEqual([`${ORG}/branding/logo.png`])
  })

  it("na cudziu firmu sa nepozrie", async () => {
    const res = await imageDataUrl(`${INY}/branding/podpis.png`, ORG)

    expect(res).toBeNull()
    // Podstatné je, že sa na to ani nespýtalo — nie len že vrátilo null.
    expect(downloaded).toHaveLength(0)
  })

  it("neprejde ani cez `..` v ceste", async () => {
    const res = await imageDataUrl(`../${INY}/branding/peciatka.png`, ORG)

    expect(res).toBeNull()
    expect(downloaded).toHaveLength(0)
  })

  it("prefix musí sedieť celý, nestačí začiatok id", async () => {
    // `org-1` nesmie otvoriť cestu firmy `org-12`.
    const res = await imageDataUrl("org-12/branding/logo.png", "org-1")

    expect(res).toBeNull()
    expect(downloaded).toHaveLength(0)
  })

  it("holé id bez lomky cudziu cestu neotvorí", async () => {
    const res = await imageDataUrl(`${ORG}x/branding/logo.png`, ORG)

    expect(res).toBeNull()
    expect(downloaded).toHaveLength(0)
  })

  it("prázdna cesta je null, nie pokus o stiahnutie", async () => {
    expect(await imageDataUrl(null, ORG)).toBeNull()
    expect(await imageDataUrl("", ORG)).toBeNull()
    expect(downloaded).toHaveLength(0)
  })
})

describe("imageDataUrl — verejná adresa", () => {
  it("https adresa kontrolu prefixu neobchádza cez úložisko", async () => {
    // Staršie záznamy majú absolútnu URL. Tá ide cez fetch, nie cez bucket —
    // takže sa cez ňu k cudziemu súboru v úložisku dostať nedá.
    const fetchMock = vi.fn(async () => ({
      ok: false,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    }))
    vi.stubGlobal("fetch", fetchMock)

    const res = await imageDataUrl("https://example.com/logo.png", ORG)

    expect(res).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(downloaded).toHaveLength(0)

    vi.unstubAllGlobals()
  })
})
