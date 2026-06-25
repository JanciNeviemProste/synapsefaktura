import "server-only"

import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

export const ACTIVE_ORG_COOKIE = "active_org"

/**
 * Returns the caller's active organization id. Honors an `active_org` cookie (set
 * by the org switcher) when it points to an org the user is a member of —
 * otherwise falls back to the first membership. RLS guarantees the membership
 * rows belong to the current user. Returns null if the user has no org yet.
 */
export async function getCurrentOrgId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const store = await cookies()
  const preferred = store.get(ACTIVE_ORG_COOKIE)?.value

  if (preferred) {
    const { data } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", preferred)
      .limit(1)
      .maybeSingle()
    if (data?.organization_id) return data.organization_id
  }

  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle()
  return data?.organization_id ?? null
}
