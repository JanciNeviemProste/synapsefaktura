import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

import { rateLimit, checkRateLimit, hasUpstash } from "./rate-limit"

describe("rateLimit (in-memory)", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test:${Math.random()}`
    expect(rateLimit(key, 2, 60_000).ok).toBe(true)
    expect(rateLimit(key, 2, 60_000).ok).toBe(true)
    const blocked = rateLimit(key, 2, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })
})

describe("checkRateLimit", () => {
  const U = "UPSTASH_REDIS_REST_URL"
  const T = "UPSTASH_REDIS_REST_TOKEN"
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    delete process.env[U]
    delete process.env[T]
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("uses the in-memory limiter when Upstash is not configured", async () => {
    expect(hasUpstash()).toBe(false)
    const key = `mem:${Math.random()}`
    expect((await checkRateLimit(key, 1, 60_000)).ok).toBe(true)
    expect((await checkRateLimit(key, 1, 60_000)).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("allows via Upstash when INCR is within the limit", async () => {
    process.env[U] = "https://x.upstash.io"
    process.env[T] = "tok"
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 1 }) }) // INCR
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 1 }) }) // PEXPIRE
    const res = await checkRateLimit("k", 5, 60_000)
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok")
  })

  it("blocks via Upstash when INCR exceeds the limit", async () => {
    process.env[U] = "https://x.upstash.io"
    process.env[T] = "tok"
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 6 }) }) // INCR > limit
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 4200 }) }) // PTTL
    const res = await checkRateLimit("k", 5, 60_000)
    expect(res.ok).toBe(false)
    expect(res.retryAfterMs).toBe(4200)
  })

  it("falls back to in-memory when Upstash errors", async () => {
    process.env[U] = "https://x.upstash.io"
    process.env[T] = "tok"
    fetchMock.mockRejectedValue(new Error("redis down"))
    const res = await checkRateLimit(`fb:${Math.random()}`, 5, 60_000)
    expect(res.ok).toBe(true) // degraded to local limiter, still allows first hit
  })
})
