import { describe, it, expect } from "vitest"
import { buildClientSnapshot } from "./client-snapshot"

const AT = "2026-08-04T10:00:00.000Z"

describe("buildClientSnapshot", () => {
  it("copies a complete contact", () => {
    expect(
      buildClientSnapshot(
        {
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
        },
        AT,
      ),
    ).toEqual({
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
    })
  })

  it("fills every key even for a contact that has only a name", () => {
    const snap = buildClientSnapshot({ name: "Ján Novák" }, AT)
    expect(snap).toEqual({
      name: "Ján Novák",
      ico: null,
      dic: null,
      ic_dph: null,
      street: null,
      city: null,
      postal_code: null,
      country: null,
      email: null,
      phone: null,
      iban: null,
      swift: null,
      snapshot_at: AT,
    })
  })

  it("turns missing and blank fields into null", () => {
    const snap = buildClientSnapshot(
      { name: "  Firma  ", ico: "", city: "   ", country: null },
      AT,
    )
    expect(snap?.name).toBe("Firma")
    expect(snap?.ico).toBeNull()
    expect(snap?.city).toBeNull()
    expect(snap?.country).toBeNull()
    expect(snap?.dic).toBeNull()
  })

  it("returns null without a name — DB constraint requires one", () => {
    expect(buildClientSnapshot({ ico: "12345678" }, AT)).toBeNull()
    expect(buildClientSnapshot({ name: "   " }, AT)).toBeNull()
    expect(buildClientSnapshot(null, AT)).toBeNull()
    expect(buildClientSnapshot(undefined, AT)).toBeNull()
  })

  it("stamps the current time when none is given", () => {
    const before = Date.now()
    const snap = buildClientSnapshot({ name: "Firma" })
    expect(Date.parse(snap!.snapshot_at)).toBeGreaterThanOrEqual(before)
  })
})
