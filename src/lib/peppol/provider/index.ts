import "server-only"

import { MockPostmanProvider } from "./mock"
import type { DigitalPostmanProvider } from "@/lib/peppol/types"

export { POSTMAN_PROVIDERS } from "./catalog"

/**
 * Resolve the transport provider for an organization, keyed by
 * `organizations.digital_postman_provider`. v1 only ships the `mock` sandbox;
 * real certified Digitálny poštár providers register here later (each a class
 * implementing `DigitalPostmanProvider`) — see §5.5.
 */
export function getPostmanProvider(
  providerCode?: string | null,
): DigitalPostmanProvider {
  switch (providerCode) {
    case "mock":
    case null:
    case undefined:
    case "":
      return new MockPostmanProvider()
    default:
      // TODO: register real certified providers (e.g. "smartfaktura", "edocu").
      // Until one is integrated, fall back to the sandbox rather than crash.
      return new MockPostmanProvider()
  }
}
