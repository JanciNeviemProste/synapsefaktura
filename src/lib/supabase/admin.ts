import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

/**
 * Service-role Supabase client — bypasses RLS. Server-only, for system jobs
 * (cron, Storage management). NEVER import this into client code. Callers MUST
 * enforce org membership themselves before using it.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
