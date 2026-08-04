import { describe, it, expect } from "vitest"
import { resolveClientDetails } from "./client-details"

const AT = "2026-08-04T10:00:00.000Z"

const SNAPSHOT = {
  name: "Odberateľ s.r.o.",
  ico: "12345678",
  dic: "2020202020",
  ic_dph: "SK2020202020",
  street: "Hlavná 1",
  city: "Bratislava",
  postal_code: "811 01",
  country: "SK",
  email: "faktury@odberatel.sk",
  phone: "+421900000000",
  iban: "SK3112000000198742637541",
  swift: "TATRSKBX",
  snapshot_at: AT,
}

const LIVE = {
  name: "Odberateľ s.r.o. (po premenovaní)",
  ico: "12345678",
  dic: "2020202020",
  ic_dph: "SK2020202020",
  street: "Nová 9",
  city: "Košice",
  postal_code: "040 01",
  country: "SK",
  email: "nove@odberatel.sk",
  phone: "+421911111111",
}

describe("resolveClientDetails", () => {
  it("prefers the snapshot over the live contact", () => {
    const { snapshot_at: _at, ...fields } = SNAPSHOT
    const r = resolveClientDetails(SNAPSHOT, LIVE)
    expect(r).toEqual({ ...fields, frozen: true, snapshotAt: AT })
  })

  it("does not let a later contact change leak into an issued document", () => {
    const r = resolveClientDetails(SNAPSHOT, LIVE)
    expect(r?.name).toBe("Odberateľ s.r.o.")
    expect(r?.street).toBe("Hlavná 1")
    expect(r?.city).toBe("Bratislava")
  })

  it("reads the contact live when the snapshot is null", () => {
    const r = resolveClientDetails(null, LIVE)
    expect(r?.frozen).toBe(false)
    expect(r?.snapshotAt).toBeNull()
    expect(r?.name).toBe("Odberateľ s.r.o. (po premenovaní)")
    expect(r?.street).toBe("Nová 9")
    // `contacts` zatial nema iban/swift - musia vyjst ako null, nie undefined.
    expect(r?.iban).toBeNull()
    expect(r?.swift).toBeNull()
  })

  it("reads live for undefined snapshot too (starsie doklady, koncepty)", () => {
    expect(resolveClientDetails(undefined, LIVE)?.frozen).toBe(false)
  })

  it("keeps missing snapshot fields missing instead of borrowing live ones", () => {
    const r = resolveClientDetails(
      { name: "Firma bez adresy", ico: "12345678", snapshot_at: AT },
      LIVE,
    )
    expect(r?.frozen).toBe(true)
    expect(r?.name).toBe("Firma bez adresy")
    expect(r?.ico).toBe("12345678")
    expect(r?.street).toBeNull()
    expect(r?.city).toBeNull()
    expect(r?.postal_code).toBeNull()
    expect(r?.country).toBeNull()
    expect(r?.email).toBeNull()
    expect(r?.dic).toBeNull()
    expect(r?.ic_dph).toBeNull()
  })

  it("treats blank and non-text snapshot fields as missing", () => {
    const r = resolveClientDetails(
      {
        name: "  Firma  ",
        ico: 12345678,
        city: "   ",
        country: null,
        street: { nested: true },
        phone: ["+421900000000"],
        snapshot_at: AT,
      },
      null,
    )
    expect(r?.name).toBe("Firma")
    // Cislo v JSON este ide zobrazit, objekt ani pole uz nie.
    expect(r?.ico).toBe("12345678")
    expect(r?.city).toBeNull()
    expect(r?.country).toBeNull()
    expect(r?.street).toBeNull()
    expect(r?.phone).toBeNull()
  })

  it("snapshot without snapshot_at stays frozen, just without the date", () => {
    const r = resolveClientDetails({ name: "Firma" }, LIVE)
    expect(r?.frozen).toBe(true)
    expect(r?.snapshotAt).toBeNull()
  })

  it("falls back to the contact when the snapshot has no usable name", () => {
    expect(resolveClientDetails({ ico: "12345678" }, LIVE)?.name).toBe(LIVE.name)
    expect(resolveClientDetails({ name: "   " }, LIVE)?.frozen).toBe(false)
  })

  it("ignores json that is not an object", () => {
    expect(resolveClientDetails("Odberateľ", LIVE)?.frozen).toBe(false)
    expect(resolveClientDetails([SNAPSHOT], LIVE)?.frozen).toBe(false)
    expect(resolveClientDetails(42, LIVE)?.frozen).toBe(false)
  })

  it("returns null when there is no customer at all", () => {
    expect(resolveClientDetails(null, null)).toBeNull()
    expect(resolveClientDetails(null, undefined)).toBeNull()
    expect(resolveClientDetails(null, { name: "  " })).toBeNull()
    expect(resolveClientDetails({ ico: "12345678" }, null)).toBeNull()
  })
})
