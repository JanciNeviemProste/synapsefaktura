import "server-only"

/**
 * EU VIES VAT-ID validation (IČ DPH). Uses the official VIES REST API.
 * Graceful: network/timeout/down → status "unknown" (VIES is frequently slow or
 * temporarily unavailable, so we never block the user on it).
 *
 * TODO: verify endpoint stability; VIES also offers a SOAP service as fallback.
 */

const VIES_URL =
  "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number"
const TIMEOUT_MS = 8000

export interface VatValidationResult {
  status: "valid" | "invalid" | "unknown"
  vatId: string
  name?: string | null
  address?: string | null
}

/** Split "SK2020000000" into ISO country code + the numeric part. */
function splitVatId(vatId: string): { country: string; number: string } | null {
  const cleaned = vatId.replace(/\s+/g, "").toUpperCase()
  const m = /^([A-Z]{2})([0-9A-Z]+)$/.exec(cleaned)
  if (!m) return null
  return { country: m[1], number: m[2] }
}

export async function validateVatId(
  vatId: string,
): Promise<VatValidationResult> {
  const parts = splitVatId(vatId)
  if (!parts) {
    return { status: "invalid", vatId }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(VIES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        countryCode: parts.country,
        vatNumber: parts.number,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { status: "unknown", vatId }
    }
    const data = (await res.json()) as {
      valid?: boolean
      isValid?: boolean
      name?: string
      address?: string
    }
    const valid = data.valid ?? data.isValid
    if (valid === undefined) {
      return { status: "unknown", vatId }
    }
    return {
      status: valid ? "valid" : "invalid",
      vatId,
      name: data.name?.trim() || null,
      address: data.address?.trim() || null,
    }
  } catch {
    return { status: "unknown", vatId }
  } finally {
    clearTimeout(timeout)
  }
}
