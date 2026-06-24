"use server"

import { generateStructured } from "@/lib/ai/generate"
import { nlInvoiceDraftSchema } from "@/lib/validation/nl-invoice"
import { saveDocument } from "@/app/actions/documents"
import type { DocumentInput } from "@/lib/validation/document"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"

export type DraftInvoiceResult =
  | { ok: true; id: string }
  | { ok: false; degraded: boolean; error: string }

/** Diacritics + case insensitive normalization for fuzzy contact matching. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * §7.2 — Build a DRAFT invoice from one Slovak sentence and never issue it.
 * Returns the new document id so the UI can open it in the editor.
 */
export async function draftInvoiceFromText(
  text: string,
): Promise<DraftInvoiceResult> {
  const input = text.trim()
  if (!input) {
    return { ok: false, degraded: false, error: "Zadaj text faktúry." }
  }

  const today = todayIso()
  const system = [
    "Si asistent, ktorý z jednej slovenskej vety vytvorí podklad pre faktúru.",
    `Dnešný dátum je ${today} (formát YYYY-MM-DD). Relatívne dátumy (napr. „dnes“, „zajtra“) prepočítaj voči nemu.`,
    "Dátumy vždy vráť vo formáte YYYY-MM-DD, alebo null, ak ich používateľ neuviedol.",
    "Ak je uvedené „+ DPH“ alebo „s DPH“, použi sadzbu DPH 23 %. Ak je cena „bez DPH“ alebo nie je o DPH zmienka, ponechaj sadzbu 23 % ako predvolenú.",
    "Pri „splatnosť N dní“ nastav dueDate = issueDate + N dní. Ak issueDate chýba, počítaj od dnešného dátumu.",
    "Sumy ber ako cenu za jednotku (unitPrice) bez DPH, ak nie je uvedené inak.",
    "Mena je predvolene EUR. Položky (items) vyplň podľa popisu služby alebo tovaru z vety.",
    "vatMode nastav na 'payer', ak nie je zjavné inak.",
  ].join(" ")

  const ai = await generateStructured({
    feature: "nl_invoice",
    schema: nlInvoiceDraftSchema,
    system,
    prompt: input,
  })

  if (!ai.ok) {
    return { ok: false, degraded: ai.degraded, error: ai.error }
  }

  const draft = ai.data

  // Resolve contact name → contactId via fuzzy match over the org's contacts.
  let contactId: string | null = null
  if (draft.contactName) {
    const supabase = await createClient()
    const orgId = await getCurrentOrgId(supabase)
    if (orgId) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("organization_id", orgId)
      const needle = normalize(draft.contactName)
      const match = (contacts ?? []).find((c) => {
        const hay = normalize(c.name)
        return hay.includes(needle) || needle.includes(hay)
      })
      contactId = match?.id ?? null
    }
  }

  const issueDate = draft.issueDate || today
  const items =
    draft.items.length > 0
      ? draft.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          discountPct: 0,
        }))
      : [
          {
            description: "",
            quantity: 1,
            unit: "ks",
            unitPrice: 0,
            vatRate: 23,
            discountPct: 0,
          },
        ]

  const documentInput: DocumentInput = {
    type: "invoice",
    contactId,
    issueDate,
    dueDate: draft.dueDate || "",
    currency: draft.currency || "EUR",
    exchangeRate: 1,
    language: "sk",
    vatMode: draft.vatMode,
    items,
  }

  // Human-in-the-loop: ALWAYS a draft, never issue:true.
  const saved = await saveDocument(documentInput, { issue: false })
  if (!saved.ok) {
    return { ok: false, degraded: false, error: saved.error }
  }

  return { ok: true, id: saved.id }
}
