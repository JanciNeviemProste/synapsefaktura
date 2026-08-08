import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// `provider.ts` is server-only; neutralize the guard so it can be unit-tested.
vi.mock("server-only", () => ({}))

import { hasEmail, sendEmail } from "./provider"

const KEY = "RESEND_API_KEY"

describe("hasEmail", () => {
  afterEach(() => {
    delete process.env[KEY]
  })

  it("is false without a key and true with one", () => {
    delete process.env[KEY]
    expect(hasEmail()).toBe(false)
    process.env[KEY] = "re_test"
    expect(hasEmail()).toBe(true)
  })
})

describe("sendEmail", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    delete process.env[KEY]
    delete process.env.EMAIL_FROM
    vi.unstubAllGlobals()
  })

  it("skips (no-op) when no key is configured and never calls fetch", async () => {
    delete process.env[KEY]
    const res = await sendEmail({
      to: "a@b.sk",
      subject: "S",
      html: "<p>x</p>",
    })
    expect(res).toEqual({ ok: false, skipped: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts to Resend and base64-encodes attachments on success", async () => {
    process.env[KEY] = "re_test"
    process.env.EMAIL_FROM = "Faktúry <f@firma.sk>"
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    })

    const res = await sendEmail({
      to: "klient@firma.sk",
      subject: "Faktúra 1",
      html: "<p>hi</p>",
      attachments: [{ filename: "f.pdf", content: Buffer.from("PDFDATA") }],
    })

    expect(res).toEqual({ ok: true, id: "email_123" })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(init.headers.Authorization).toBe("Bearer re_test")
    const body = JSON.parse(init.body)
    expect(body.from).toBe("Faktúry <f@firma.sk>")
    expect(body.to).toBe("klient@firma.sk")
    expect(body.attachments[0].filename).toBe("f.pdf")
    expect(body.attachments[0].content).toBe(
      Buffer.from("PDFDATA").toString("base64"),
    )
  })

  it("returns an error (does not throw) on a non-OK HTTP response", async () => {
    process.env[KEY] = "re_test"
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Invalid from address",
    })
    const res = await sendEmail({
      to: "a@b.sk",
      subject: "S",
      html: "<p>x</p>",
    })
    expect(res.ok).toBe(false)
    expect(res.skipped).toBeUndefined()
    expect(res.error).toContain("422")
  })

  it("returns an error (does not throw) when fetch rejects", async () => {
    process.env[KEY] = "re_test"
    fetchMock.mockRejectedValue(new Error("network down"))
    const res = await sendEmail({
      to: "a@b.sk",
      subject: "S",
      html: "<p>x</p>",
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain("network down")
  })
})
