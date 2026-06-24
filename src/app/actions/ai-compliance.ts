"use server"

import { createClient } from "@/lib/supabase/server"
import { checkCompliance, type ComplianceResult } from "@/lib/ai/compliance"

/**
 * Loads a document with its items, supplier org, customer contact and the VAT
 * rate table, then runs the pure §74/DPH compliance checker (§7.4). RLS scopes
 * the reads to the current org. Advisory only — never blocks issuing.
 */
export async function checkDocumentCompliance(
  documentId: string,
): Promise<ComplianceResult> {
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle()

  if (!doc) {
    return {
      score: 0,
      issues: [
        {
          severity: "error",
          message: "Doklad sa nenašiel.",
        },
      ],
    }
  }

  const [itemsRes, orgRes, contactRes, ratesRes, ibanRes] = await Promise.all([
    supabase
      .from("document_items")
      .select("*")
      .eq("document_id", documentId)
      .order("position", { ascending: true }),
    supabase
      .from("organizations")
      .select("*")
      .eq("id", doc.organization_id)
      .maybeSingle(),
    doc.contact_id
      ? supabase
          .from("contacts")
          .select("*")
          .eq("id", doc.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("vat_rates").select("*"),
    supabase
      .from("bank_accounts")
      .select("iban, is_default, currency")
      .eq("organization_id", doc.organization_id),
  ])

  const org = orgRes.data
  if (!org) {
    return {
      score: 0,
      issues: [
        {
          severity: "error",
          message: "Firma sa nenašla.",
        },
      ],
    }
  }

  const banks = ibanRes.data ?? []
  const iban =
    banks.find((b) => b.is_default && b.currency === doc.currency)?.iban ??
    banks.find((b) => b.is_default)?.iban ??
    banks.find((b) => b.currency === doc.currency)?.iban ??
    banks[0]?.iban ??
    null

  return checkCompliance({
    doc,
    items: itemsRes.data ?? [],
    org,
    contact: contactRes.data ?? null,
    vatRates: ratesRes.data ?? [],
    iban,
  })
}
