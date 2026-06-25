"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { rateLimit } from "@/lib/security/rate-limit"
import { getStripe, hasStripe, appBaseUrl } from "@/lib/billing/stripe"
import { issuedThisMonth } from "@/lib/billing/gate"
import { PLANS, type PlanTier } from "@/lib/billing/plans"

export type BillingInfo = {
  plan: PlanTier
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  stripeConfigured: boolean
  issuedThisMonth: number
  docLimit: number | null
}

/** True when the current user is owner/admin of the given org. */
async function isOrgManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle()
  return data?.role === "owner" || data?.role === "admin"
}

export async function getBillingInfo(): Promise<BillingInfo | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return null

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "plan, subscription_status, current_period_end, stripe_customer_id",
    )
    .eq("id", orgId)
    .maybeSingle()

  const plan: PlanTier = org?.plan ?? "free"
  const used = (await issuedThisMonth(supabase, orgId)) ?? 0

  return {
    plan,
    subscriptionStatus: org?.subscription_status ?? null,
    currentPeriodEnd: org?.current_period_end ?? null,
    stripeConfigured: hasStripe(),
    issuedThisMonth: used,
    docLimit: PLANS[plan].docsPerMonth,
  }
}

export async function startCheckout(
  tier: "pro" | "business",
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Nemáte priradenú organizáciu." }

  if (!(await isOrgManager(supabase, orgId))) {
    return {
      ok: false,
      error: "Len vlastník alebo admin môže spravovať predplatné.",
    }
  }

  const limited = rateLimit(`checkout:${orgId}`, 5, 60_000)
  if (!limited.ok) {
    return { ok: false, error: "Príliš veľa pokusov. Skúste to o chvíľu." }
  }

  if (!hasStripe()) {
    return {
      ok: false,
      error: "Platby nie sú nakonfigurované. Stripe kľúče doplníte neskôr.",
    }
  }

  const priceEnv = PLANS[tier].stripePriceEnv
  const priceId = priceEnv ? process.env[priceEnv] : undefined
  if (!priceId) {
    return { ok: false, error: "Cena pre tento plán nie je nastavená." }
  }

  const stripe = getStripe()!

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id, name")
    .eq("id", orgId)
    .maybeSingle()

  try {
    let customerId = org?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org?.name ?? undefined,
        metadata: { organization_id: orgId },
      })
      customerId = customer.id
      const { error: linkErr } = await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId)
      if (linkErr) {
        // Don't proceed with an unlinked customer — a second checkout would
        // create a duplicate the webhook can't reliably reverse-map.
        console.error("[billing] failed to link stripe customer", linkErr)
        return { ok: false, error: "Platbu sa nepodarilo spustiť. Skúste to znova." }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: orgId,
      metadata: { organization_id: orgId },
      success_url: `${appBaseUrl()}/app/settings?billing=success`,
      cancel_url: `${appBaseUrl()}/app/settings?billing=cancel`,
    })

    if (!session.url) {
      return { ok: false, error: "Platbu sa nepodarilo spustiť." }
    }
    return { ok: true, url: session.url }
  } catch (err) {
    console.error("[billing] startCheckout failed", err)
    return { ok: false, error: "Platbu sa nepodarilo spustiť. Skúste to znova." }
  }
}

export async function openPortal(): Promise<{
  ok: boolean
  url?: string
  error?: string
}> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Nemáte priradenú organizáciu." }

  if (!(await isOrgManager(supabase, orgId))) {
    return {
      ok: false,
      error: "Len vlastník alebo admin môže spravovať predplatné.",
    }
  }

  if (!hasStripe()) {
    return { ok: false, error: "Žiadne aktívne predplatné." }
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .maybeSingle()

  if (!org?.stripe_customer_id) {
    return { ok: false, error: "Žiadne aktívne predplatné." }
  }

  const stripe = getStripe()!

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appBaseUrl()}/app/settings`,
    })
    return { ok: true, url: session.url }
  } catch (err) {
    console.error("[billing] openPortal failed", err)
    return { ok: false, error: "Portál sa nepodarilo otvoriť. Skúste to znova." }
  }
}
