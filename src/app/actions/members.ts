"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { gateFeature } from "@/lib/billing/gate"
import { checkRateLimit } from "@/lib/security/rate-limit"

export type Member = {
  userId: string
  email: string
  role: string
  isSelf: boolean
}
export type PendingInvite = {
  id: string
  email: string | null
  role: string
  token: string
  expiresAt: string
}

const MANAGE_ROLES = new Set(["owner", "admin"])

/**
 * Returns the caller's role in `orgId`, or null if not a member. The mutating
 * actions use this to gate management to owner/admin.
 */
async function getMyRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle()
  return data?.role ?? null
}

const NOT_ALLOWED = "Len vlastník alebo admin môže spravovať tím."

/** Gate a mutating action: returns the caller role or an error message. */
async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<{ role: string } | { error: string }> {
  const role = await getMyRole(supabase, orgId)
  if (!role || !MANAGE_ROLES.has(role)) return { error: NOT_ALLOWED }
  return { role }
}

export async function listMembers(): Promise<Member[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // RLS returns only memberships of orgs the caller belongs to — this both
  // verifies the caller is a member and yields the member user_ids.
  const { data: rows } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })
  if (!rows || rows.length === 0) return []

  // auth.users isn't reachable via RLS — resolve emails through the admin client,
  // restricted to this org's member user_ids (caller membership verified above).
  const admin = createAdminClient()
  const emailById = new Map<string, string>()
  await Promise.all(
    rows.map(async (r) => {
      const { data } = await admin.auth.admin.getUserById(r.user_id)
      if (data?.user?.email) emailById.set(r.user_id, data.user.email)
    }),
  )

  return rows.map((r) => ({
    userId: r.user_id,
    email: emailById.get(r.user_id) ?? "—",
    role: r.role,
    isSelf: r.user_id === user.id,
  }))
}

export async function listPendingInvites(): Promise<PendingInvite[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []
  // RLS: only owner/admin of the org can select invites.
  const { data } = await supabase
    .from("org_invites")
    .select("id, email, role, token, expires_at")
    .eq("organization_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    token: i.token,
    expiresAt: i.expires_at,
  }))
}

export async function inviteMember(
  email: string,
  role: "admin" | "accountant" | "member",
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Žiadna aktívna firma." }

  const gate = await requireAdmin(supabase, orgId)
  if ("error" in gate) return { ok: false, error: gate.error }

  const limited = await checkRateLimit(`invite:${orgId}`, 10, 60_000)
  if (!limited.ok) {
    return {
      ok: false,
      error: "Priveľa pozvánok. Skúste to o chvíľu znova.",
    }
  }

  const feature = await gateFeature(supabase, orgId, "multiUser")
  if (!feature.allowed) return { ok: false, error: feature.reason }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Najprv sa prihláste." }

  // Email is optional (invite is a shareable link), but if provided it must be
  // a valid address — we store and display it back to admins.
  const trimmed = email.trim()
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Neplatný e-mail." }
  }

  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")

  const { error } = await supabase.from("org_invites").insert({
    organization_id: orgId,
    email: trimmed || null,
    role,
    token,
    invited_by: user.id,
  })
  if (error) {
    console.error("[members] inviteMember insert failed", error)
    return { ok: false, error: "Pozvánku sa nepodarilo vytvoriť." }
  }
  return { ok: true, token }
}

export async function revokeInvite(
  inviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Žiadna aktívna firma." }

  const gate = await requireAdmin(supabase, orgId)
  if ("error" in gate) return { ok: false, error: gate.error }

  const { error } = await supabase
    .from("org_invites")
    .delete()
    .eq("id", inviteId)
    .eq("organization_id", orgId)
  if (error) return { ok: false, error: "Pozvánku sa nepodarilo zrušiť." }
  return { ok: true }
}

export async function acceptInvite(
  token: string,
): Promise<{ ok: boolean; error?: string; organizationId?: string }> {
  // The invitee is not yet a member, so org_invites RLS would block them —
  // use the service-role admin client for the whole accept path.
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from("org_invites")
    .select("organization_id, role, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle()
  if (!invite) return { ok: false, error: "Pozvánka neexistuje." }
  if (invite.accepted_at) {
    return { ok: false, error: "Pozvánka už bola použitá." }
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Platnosť pozvánky vypršala." }
  }

  // Identify the current user via the RLS-bound client (their session).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Najprv sa prihláste." }

  // Atomically claim the invite (single-use): the conditional update succeeds for
  // exactly one of any concurrent accepts. Claim BEFORE adding membership so a
  // race can't double-consume the token.
  const { data: claimed, error: claimErr } = await admin
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token)
    .is("accepted_at", null)
    .select("organization_id, role")
    .maybeSingle()
  if (claimErr) {
    console.error("[members] acceptInvite claim failed", claimErr)
    return { ok: false, error: "Členstvo sa nepodarilo vytvoriť." }
  }
  if (!claimed) return { ok: false, error: "Pozvánka už bola použitá." }

  const { error: upsertError } = await admin
    .from("organization_members")
    .upsert(
      {
        organization_id: claimed.organization_id,
        user_id: user.id,
        role: claimed.role,
      },
      { onConflict: "organization_id,user_id", ignoreDuplicates: true },
    )
  if (upsertError) {
    // Release the claim so the invite can be retried.
    console.error("[members] acceptInvite membership failed", upsertError)
    await admin
      .from("org_invites")
      .update({ accepted_at: null })
      .eq("token", token)
    return { ok: false, error: "Členstvo sa nepodarilo vytvoriť." }
  }

  return { ok: true, organizationId: claimed.organization_id }
}

export async function updateMemberRole(
  userId: string,
  role: "admin" | "accountant" | "member",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Žiadna aktívna firma." }

  const gate = await requireAdmin(supabase, orgId)
  if ("error" in gate) return { ok: false, error: gate.error }

  // Look up the target's current role; never touch the owner.
  const { data: target } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()
  if (!target) return { ok: false, error: "Člen sa nenašiel." }
  if (target.role === "owner") {
    return { ok: false, error: "Rolu vlastníka nie je možné zmeniť." }
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
  if (error) return { ok: false, error: "Rolu sa nepodarilo zmeniť." }
  return { ok: true }
}

export async function removeMember(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Žiadna aktívna firma." }

  const gate = await requireAdmin(supabase, orgId)
  if ("error" in gate) return { ok: false, error: gate.error }

  const { data: target } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()
  if (!target) return { ok: false, error: "Člen sa nenašiel." }
  if (target.role === "owner") {
    return { ok: false, error: "Vlastníka nie je možné odstrániť." }
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId)
  if (error) return { ok: false, error: "Člena sa nepodarilo odstrániť." }
  return { ok: true }
}
