"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { slovakPeppolId, isValidPeppolId } from "@/lib/peppol/id"
import { getPostmanProvider } from "@/lib/peppol/provider"

export type EInvoiceSettings = {
  enabled: boolean
  peppolId: string | null
  provider: string
  dic: string | null
  suggestedPeppolId: string | null // slovakPeppolId(org.dic)
}

export type EInvoiceSettingsInput = {
  enabled: boolean
  peppolId?: string
  provider: string
}

/** Load the current org's e-invoicing settings. Returns null if no org. */
export async function getEInvoiceSettings(): Promise<EInvoiceSettings | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return null

  const { data: org } = await supabase
    .from("organizations")
    .select("dic, peppol_id, einvoice_enabled, digital_postman_provider")
    .eq("id", orgId)
    .maybeSingle()

  if (!org) return null

  return {
    enabled: org.einvoice_enabled ?? false,
    peppolId: org.peppol_id ?? null,
    provider: org.digital_postman_provider ?? "mock",
    dic: org.dic ?? null,
    suggestedPeppolId: slovakPeppolId(org.dic),
  }
}

/**
 * Persist e-invoicing settings on the current org. Inputs are validated
 * manually (this `"use server"` file must export only async functions).
 */
export async function updateEInvoiceSettings(
  input: EInvoiceSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  const enabled = Boolean(input?.enabled)
  const provider = (input?.provider ?? "").trim() || "mock"
  const rawPeppolId = (input?.peppolId ?? "").trim()
  const peppolId = rawPeppolId === "" ? null : rawPeppolId

  if (peppolId !== null && !isValidPeppolId(peppolId)) {
    return { ok: false, error: "Neplatný formát Peppol ID (napr. 0245:2020317068)." }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: org } = await supabase
    .from("organizations")
    .select("dic")
    .eq("id", orgId)
    .maybeSingle()

  const effectivePeppolId = peppolId ?? slovakPeppolId(org?.dic ?? null)

  if (enabled && !effectivePeppolId) {
    return { ok: false, error: "Zadajte Peppol ID alebo si doplňte DIČ." }
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      einvoice_enabled: enabled,
      peppol_id: peppolId,
      digital_postman_provider: provider,
    })
    .eq("id", orgId)

  if (error) {
    return { ok: false, error: "Nastavenia sa nepodarilo uložiť." }
  }

  revalidatePath("/app/settings")
  return { ok: true }
}

/** Verify the org's Peppol participant is reachable via its provider. */
export async function testEInvoiceConnection(): Promise<{
  ok: boolean
  found: boolean
  message: string
}> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { ok: false, found: false, message: "Chýba firma." }
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("dic, peppol_id, digital_postman_provider")
    .eq("id", orgId)
    .maybeSingle()

  const peppolId = org?.peppol_id || slovakPeppolId(org?.dic ?? null)
  if (!peppolId) {
    return { ok: false, found: false, message: "Najprv nastavte Peppol ID." }
  }

  const provider = getPostmanProvider(org?.digital_postman_provider)
  const res = await provider.lookupParticipant(peppolId)

  return {
    ok: true,
    found: res.found,
    message: res.found
      ? `Účastník ${peppolId} je dostupný.`
      : `Účastník ${peppolId} sa nenašiel.`,
  }
}
