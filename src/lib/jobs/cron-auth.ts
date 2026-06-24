/**
 * Authorizes a cron request. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * A `?secret=` query param is also accepted so jobs are triggerable manually
 * during local development.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true
  return new URL(req.url).searchParams.get("secret") === secret
}
