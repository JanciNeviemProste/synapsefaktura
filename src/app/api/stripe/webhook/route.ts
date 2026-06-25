import type Stripe from "stripe"

import { getStripe, hasStripe } from "@/lib/billing/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PlanTier } from "@/lib/billing/plans"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Map a Stripe price id to a plan tier via the configured env vars. */
function tierForPrice(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business"
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro"
  return null
}

/** Pull the period-end unix ts out of a subscription (Basil moved it onto items). */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number })
    .current_period_end
  const item = sub.items?.data?.[0]?.current_period_end
  const ts = top ?? item
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null
}

type Admin = ReturnType<typeof createAdminClient>

/** Resolve an org id from a checkout session or subscription event. */
async function resolveOrgId(
  db: Admin,
  opts: { reference?: string | null; customerId?: string | null },
): Promise<string | null> {
  if (opts.reference) return opts.reference
  if (opts.customerId) {
    const { data } = await db
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", opts.customerId)
      .maybeSingle()
    return data?.id ?? null
  }
  return null
}

async function applySubscription(
  db: Admin,
  orgId: string,
  sub: Stripe.Subscription,
) {
  const priceId = sub.items?.data?.[0]?.price?.id
  const tier = tierForPrice(priceId)
  await db
    .from("organizations")
    .update({
      ...(tier ? { plan: tier } : {}),
      stripe_subscription_id: sub.id,
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      subscription_status: sub.status,
      current_period_end: periodEndIso(sub),
    })
    .eq("id", orgId)
}

export async function POST(req: Request) {
  if (!hasStripe()) {
    return Response.json({ received: true, skipped: true })
  }

  const stripe = getStripe()!
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig ?? "",
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }

  try {
    const db = createAdminClient()

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = await resolveOrgId(db, {
          reference:
            session.client_reference_id ??
            (session.metadata?.organization_id || null),
          customerId:
            typeof session.customer === "string" ? session.customer : null,
        })
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null)
        if (orgId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          await applySubscription(db, orgId, sub)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const orgId = await resolveOrgId(db, {
          reference: sub.metadata?.organization_id || null,
          customerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        })
        if (orgId) await applySubscription(db, orgId, sub)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const orgId = await resolveOrgId(db, {
          reference: sub.metadata?.organization_id || null,
          customerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        })
        if (orgId) {
          await db
            .from("organizations")
            .update({ plan: "free", subscription_status: "canceled" })
            .eq("id", orgId)
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    // Never throw out of the handler — returning 200 avoids Stripe retry storms.
    console.error("[stripe webhook] handler error", err)
  }

  return Response.json({ received: true })
}
