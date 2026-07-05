import "server-only"

/**
 * Rate limiting for sensitive server actions (invites, checkout, AI calls).
 *
 * Two backends behind one async API (`checkRateLimit`):
 *  - **Upstash Redis** (REST) when `UPSTASH_REDIS_REST_URL/TOKEN` are set — shared
 *    across all serverless instances (correct for production on Vercel).
 *  - **In-memory** fixed window (`rateLimit`) as the fallback — per-process only,
 *    fine for local/single-instance and for blunting runaway loops.
 *
 * Fail-open to the in-memory limiter if Upstash errors, so a Redis outage slows
 * abuse locally rather than opening the gate completely.
 */

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export type RateLimitResult = { ok: boolean; retryAfterMs?: number }

/** In-memory fixed-window limiter (fallback / single-instance). Synchronous. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now }
  }
  b.count += 1
  return { ok: true }
}

/** True when a shared Upstash Redis backend is configured. */
export function hasUpstash(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  )
}

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL as string
  const token = process.env.UPSTASH_REDIS_REST_TOKEN as string
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = (await res.json()) as { result?: unknown }
  return data.result
}

/**
 * Allow up to `limit` events per `windowMs` for `key`. Uses Upstash when
 * configured (shared across instances), otherwise the in-memory limiter.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!hasUpstash()) return rateLimit(key, limit, windowMs)

  try {
    const count = Number(await upstashCommand(["INCR", key]))
    if (count === 1) {
      // First hit in this window — set the expiry.
      await upstashCommand(["PEXPIRE", key, windowMs])
    }
    if (count > limit) {
      const pttl = Number(await upstashCommand(["PTTL", key]))
      return { ok: false, retryAfterMs: pttl > 0 ? pttl : windowMs }
    }
    return { ok: true }
  } catch (err) {
    // Redis hiccup — degrade to the local limiter rather than failing open.
    console.error("[rate-limit] Upstash error, falling back to in-memory", err)
    return rateLimit(key, limit, windowMs)
  }
}
