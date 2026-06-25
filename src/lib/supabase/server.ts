import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./database.types"
import { requireSupabaseEnv } from "./env"

type CookieToSet = { name: string; value: string; options?: CookieOptions }

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads/writes the auth session through Next.js cookies.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = requireSupabaseEnv()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // `setAll` called from a Server Component — safe to ignore when
          // middleware is refreshing the session.
        }
      },
    },
  })
}
