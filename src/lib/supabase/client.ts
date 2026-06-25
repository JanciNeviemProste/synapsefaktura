import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"
import { requireSupabaseEnv } from "./env"

/**
 * Supabase client for use in Client Components (browser).
 * Uses the public anon key — never the service-role key.
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv()
  return createBrowserClient<Database>(url, anonKey)
}
