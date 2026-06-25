/**
 * Single accessor for the public Supabase connection env. Lets every client and
 * the middleware degrade gracefully (and report clearly) when the deploy hasn't
 * been configured yet — instead of passing `undefined!` into `createServerClient`
 * and crashing the Edge middleware with an opaque `MIDDLEWARE_INVOCATION_FAILED`.
 */

export function supabaseEnv(): {
  url: string | undefined
  anonKey: string | undefined
  configured: boolean
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, anonKey, configured: Boolean(url && anonKey) }
}

const MISSING =
  "Supabase nie je nakonfigurované — chýba NEXT_PUBLIC_SUPABASE_URL alebo " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY. Doplňte ich do prostredia (Vercel → Environment " +
  "Variables) a redeploynite."

/** Returns the connection env or throws a clear, user-facing error. */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const { url, anonKey, configured } = supabaseEnv()
  if (!configured) throw new Error(MISSING)
  return { url: url as string, anonKey: anonKey as string }
}

/** Service-role key for system jobs (server-only). Throws clearly if absent. */
export function requireServiceRoleEnv(): { url: string; serviceKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      "Chýba NEXT_PUBLIC_SUPABASE_URL alebo SUPABASE_SERVICE_ROLE_KEY pre " +
        "systémové operácie (service role).",
    )
  }
  return { url, serviceKey }
}
