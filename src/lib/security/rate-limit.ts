import "server-only"

/**
 * Lightweight in-memory token-bucket rate limiter for sensitive server actions
 * (invites, AI calls, checkout). Per-process only — fine for a single Vercel
 * function instance and for blunting abuse/runaway loops.
 *
 * // TODO: for multi-instance production, back this with Upstash Redis (or
 * // Vercel KV) so limits are shared across function instances.
 */

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export type RateLimitResult = { ok: boolean; retryAfterMs?: number }

/**
 * Allow up to `limit` events per `windowMs` for a given key (e.g.
 * `invite:<orgId>` or `ai:<userId>`). Returns `{ ok: false }` when exceeded.
 */
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
