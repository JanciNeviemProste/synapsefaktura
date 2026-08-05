/**
 * Malé dvojníky Supabase klienta pre testy server actions.
 *
 * PREČO NIE MOCK NA KAŽDÝ ZAVOLANÝ RIADOK: pri nahrávaní je podstatné, čo po
 * akcii ZOSTANE v úložisku — či sa zlý súbor naozaj zmazal a či sa predchádzajúce
 * logo upratalo. To sa na jednotlivých volaniach overiť nedá, preto je tu
 * úložisko so skutočným stavom, do ktorého sa dá po akcii pozrieť.
 */

/** Úložisko v pamäti: cesta → obsah. */
export class FakeStorage {
  files = new Map<string, Uint8Array>()
  /** Cesty, na ktoré sa vydal podpísaný lístok. */
  signed: string[] = []
  buckets: string[] = ["attachments"]

  put(path: string, bytes: Uint8Array) {
    this.files.set(path, bytes)
  }

  has(path: string) {
    return this.files.has(path)
  }

  /** Klient tak, ako ho vracia `createAdminClient()`. */
  client = () => {
    // Sipkove funkcie drzia `this` triedy, takze sa nemusi aliasovat.
    return {
      storage: {
        listBuckets: async () => ({
          data: this.buckets.map((name) => ({ name })),
          error: null,
        }),
        createBucket: async (name: string) => {
          this.buckets.push(name)
          return { data: { name }, error: null }
        },
        from: () => ({
          createSignedUploadUrl: async (path: string) => {
            this.signed.push(path)
            return {
              data: { path, token: `token-${this.signed.length}`, signedUrl: "x" },
              error: null,
            }
          },
          download: async (path: string) => {
            const bytes = this.files.get(path)
            if (!bytes) {
              return { data: null, error: { message: "not found" } }
            }
            return {
              data: {
                type: "application/octet-stream",
                arrayBuffer: async () =>
                  bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                  ) as ArrayBuffer,
              },
              error: null,
            }
          },
          remove: async (paths: string[]) => {
            for (const p of paths) this.files.delete(p)
            return { data: null, error: null }
          },
        }),
      },
    }
  }
}

export type FakeDbOptions = {
  /** Rola volajúceho v organizácii. `null` = nie je členom. */
  role?: "owner" | "admin" | "member" | null
  userId?: string | null
  /** Hodnoty stĺpcov `organizations`, ktoré akcia číta. */
  organization?: Record<string, unknown>
  /** Keď je `true`, `update` na `organizations` neovplyvní žiadny riadok. */
  updateBlocked?: boolean
}

/** Zachytený zápis do tabuľky, aby sa dal v teste skontrolovať. */
export type FakeWrite = { table: string; values: Record<string, unknown> }

/**
 * Klient tak, ako ho vracia `createClient()` — len tie časti, ktoré akcie
 * nahrávania naozaj používajú.
 */
export function fakeDb(options: FakeDbOptions = {}) {
  const { role = "owner", userId = "user-1" } = options
  const writes: FakeWrite[] = []

  function builder(table: string) {
    // `update` zapisuje až pri `select(...)`, lebo práve výsledok `select`u
    // rozlišuje úspešný zápis od zápisu odfiltrovaného cez RLS.
    let pending: Record<string, unknown> | null = null

    const api = {
      eq: () => api,
      in: () => api,
      limit: () => api,
      order: () => api,
      select: (cols?: string) => {
        if (pending !== null && cols !== undefined) {
          writes.push({ table, values: pending })
          pending = null
          return Promise.resolve(
            options.updateBlocked
              ? { data: [], error: null }
              : { data: [{ id: "org-1" }], error: null },
          )
        }
        return api
      },
      maybeSingle: async () => {
        if (table === "organization_members") {
          return role === null
            ? { data: null, error: null }
            : { data: { role, organization_id: "org-1" }, error: null }
        }
        if (table === "organizations") {
          return { data: options.organization ?? {}, error: null }
        }
        return { data: null, error: null }
      },
      single: async () => ({ data: { id: "row-1" }, error: null }),
      update: (values: Record<string, unknown>) => {
        pending = values
        return api
      },
      insert: (values: Record<string, unknown>) => {
        writes.push({ table, values })
        return api
      },
    }

    return api as unknown as Record<string, never>
  }

  return {
    client: {
      auth: {
        getUser: async () => ({
          data: { user: userId ? { id: userId } : null },
          error: null,
        }),
      },
      from: (table: string) => builder(table),
    },
    writes,
  }
}

/** Najmenší platný PNG podľa magických bajtov (na validáciu obsahu stačí). */
export function pngBytes(size = 64): Uint8Array {
  const b = new Uint8Array(size)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  return b
}

/** Bajty, ktoré nie sú obrázok — napr. omylom nahraté PDF alebo zošit. */
export function pdfBytes(size = 64): Uint8Array {
  const b = new Uint8Array(size)
  b.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0) // %PDF-
  return b
}
