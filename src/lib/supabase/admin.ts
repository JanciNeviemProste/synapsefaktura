import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { requireServiceRoleEnv } from "./env"

/**
 * Service-role Supabase client — bypasses RLS. Server-only, for system jobs
 * (cron, Storage management). NEVER import this into client code. Callers MUST
 * enforce org membership themselves before using it.
 */
export function createAdminClient() {
  const { url, serviceKey } = requireServiceRoleEnv()
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
