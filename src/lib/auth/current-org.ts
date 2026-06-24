import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

/**
 * Returns the caller's active organization id (first membership). RLS guarantees
 * the row belongs to the current user. Returns null if the user has no org yet.
 */
export async function getCurrentOrgId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle()
  return data?.organization_id ?? null
}
