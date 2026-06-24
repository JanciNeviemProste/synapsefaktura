import "server-only"

import {
  companyLookupResultSchema,
  type CompanyLookupResult,
  type CompanyRegistryProvider,
} from "./types"

const DEFAULT_BASE_URL = "https://api.statistics.sk/rpo/v1"
const TIMEOUT_MS = 8000

/**
 * RPO (Register právnických osôb, Štatistický úrad SR) — free, official registry.
 * IČO → company name / legal form / address autofill.
 *
 * TODO: verify the exact endpoint, query param and response shape against the
 * official ŠÚ SR API docs (api.statistics.sk / RPO) before production. The mapping
 * below is defensive (optional chaining everywhere) so an unexpected shape yields
 * null rather than throwing.
 */
export class RpoRegistryProvider implements CompanyRegistryProvider {
  constructor(
    private readonly baseUrl = process.env.RPO_API_BASE_URL ?? DEFAULT_BASE_URL,
  ) {}

  async lookupByIco(ico: string): Promise<CompanyLookupResult | null> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/search?identifier=${encodeURIComponent(ico)}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let payload: unknown
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
        // Registry data is stable enough to cache briefly.
        next: { revalidate: 60 * 60 * 24 },
      })
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`RPO lookup failed: ${res.status} ${res.statusText}`)
      }
      payload = await res.json()
    } finally {
      clearTimeout(timeout)
    }

    return mapRpoResponse(payload, ico)
  }
}

/** Maps the raw RPO response to our normalized result. Returns null if empty. */
function mapRpoResponse(
  payload: unknown,
  ico: string,
): CompanyLookupResult | null {
  const root = payload as {
    results?: Array<{
      fullNames?: Array<{ value?: string }>
      legalForms?: Array<{ value?: string }>
      identifiers?: Array<{ value?: string }>
      addresses?: Array<{
        street?: string
        buildingNumber?: string
        municipality?: { value?: string }
        postalCodes?: string[]
      }>
    }>
  } | null

  const entity = root?.results?.[0]
  if (!entity) return null

  const address = entity.addresses?.[0]
  const streetParts = [address?.street, address?.buildingNumber].filter(Boolean)

  const candidate: CompanyLookupResult = {
    ico,
    name: entity.fullNames?.[0]?.value ?? "",
    legalForm: entity.legalForms?.[0]?.value ?? null,
    dic: null, // RPO does not expose DIČ/IČ DPH; user fills these in.
    icDph: null,
    street: streetParts.length ? streetParts.join(" ") : null,
    city: address?.municipality?.value ?? null,
    postalCode: address?.postalCodes?.[0] ?? null,
    country: "SK",
  }

  if (!candidate.name) return null

  const parsed = companyLookupResultSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
