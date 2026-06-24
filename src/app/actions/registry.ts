"use server"

import {
  icoSchema,
  lookupCompanyByIco,
  type CompanyLookupResult,
} from "@/lib/registry"
import { validateVatId, type VatValidationResult } from "@/lib/registry/vies"

export type RegistryLookupResult =
  | { ok: true; data: CompanyLookupResult }
  | { ok: false; error: string }

/**
 * Looks up a company by IČO via the registry layer (RPO). Used by the onboarding
 * wizard to autofill company details. Server-side only — keeps the registry
 * endpoint off the client.
 */
export async function searchCompanyByIco(
  ico: string,
): Promise<RegistryLookupResult> {
  const parsed = icoSchema.safeParse(ico)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Neplatné IČO.",
    }
  }

  try {
    const company = await lookupCompanyByIco(parsed.data)
    if (!company) {
      return { ok: false, error: "Firma s týmto IČO sa nenašla." }
    }
    return { ok: true, data: company }
  } catch {
    return {
      ok: false,
      error:
        "Register je momentálne nedostupný. Skús to znova alebo vyplň údaje ručne.",
    }
  }
}

/**
 * Validates an EU VAT ID (IČ DPH) via VIES. Server-side only. Returns "unknown"
 * when VIES is unavailable so the UI degrades gracefully rather than blocking.
 */
export async function validateIcDph(
  icDph: string,
): Promise<VatValidationResult> {
  const trimmed = icDph.trim()
  if (!trimmed) {
    return { status: "invalid", vatId: icDph }
  }
  return validateVatId(trimmed)
}
