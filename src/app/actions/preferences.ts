"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId, ACTIVE_ORG_COOKIE } from "@/lib/auth/current-org"
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/request"

const YEAR = 60 * 60 * 24 * 365

/** Persist the UI language to a cookie (+ the user's profile.locale). */
export async function setLocale(locale: Locale): Promise<{ ok: boolean }> {
  if (!(LOCALES as readonly string[]).includes(locale)) return { ok: false }
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" })

  // Best-effort: remember it on the profile too (ignored if not signed in).
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("profiles").update({ locale }).eq("id", user.id)
    }
  } catch {
    // cookie is the source of truth; profile sync is best-effort
  }
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Switch the active organization (org switcher / accountant multi-org). */
export async function setActiveOrg(
  orgId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  // Verify the caller is actually a member (RLS only returns their memberships).
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle()
  if (!data?.organization_id) {
    return { ok: false, error: "Nie ste členom tejto firmy." }
  }
  const store = await cookies()
  store.set(ACTIVE_ORG_COOKIE, orgId, {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
  })
  revalidatePath("/app", "layout")
  return { ok: true }
}

/** List the organizations the caller belongs to (for the org switcher). */
export async function listMyOrganizations(): Promise<
  { id: string; name: string; role: string }[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name)")
    .order("created_at", { ascending: true })
  return (data ?? []).flatMap((m) => {
    const org = m.organizations as { id: string; name: string } | null
    return org ? [{ id: org.id, name: org.name, role: m.role as string }] : []
  })
}

/** The currently active organization id (for highlighting in the switcher). */
export async function getActiveOrgId(): Promise<string | null> {
  const supabase = await createClient()
  return getCurrentOrgId(supabase)
}
