import "server-only"

import Stripe from "stripe"

/**
 * Lazily-constructed server-only Stripe client. Graceful degradation: when
 * `STRIPE_SECRET_KEY` is unset (dev / not-yet-configured), `getStripe()` returns
 * null and the billing actions surface a clear "Stripe nie je nakonfigurované"
 * message instead of crashing. Same pattern as the AI key and Peppol provider.
 */

let client: Stripe | null = null

export function hasStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripe(): Stripe | null {
  if (!hasStripe()) return null
  if (!client) {
    // Use the SDK's pinned default API version (avoids a literal-type mismatch
    // across stripe SDK bumps). Override deliberately if a feature needs it.
    client = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  }
  return client
}

/** Public base URL for Stripe redirect (checkout/portal return) URLs. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  )
}
