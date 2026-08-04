"use server"

import { generateStructured } from "@/lib/ai/generate"
import { nlInvoiceDraftSchema } from "@/lib/validation/nl-invoice"
import { saveDocument } from "@/app/actions/documents"
import type { DocumentInput } from "@/lib/validation/document"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { matchContactByName } from "@/lib/contacts/match-name"
import { isZeroVatMode } from "@/lib/vat/engine"
import type { VatMode } from "@/lib/validation/org"

export type DraftInvoiceResult =
  | { ok: true; id: string }
  | { ok: false; degraded: boolean; error: string }

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

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez údajov firmy by neplatiteľ DPH dostal koncept s 23 % a režimom platiteľa.
  const { data: org } = orgId
    ? await supabase
        .from("organizations")
        .select("is_vat_payer, vat_mode_default")
        .eq("id", orgId)
        .maybeSingle()
    : { data: null }

  // Keď sa organizácia nedá načítať, ostáva pôvodné správanie — koncept aj tak
  // neuloží saveDocument, ktorý organizáciu vyžaduje.
  const isVatPayer = org?.is_vat_payer ?? true
  const orgVatMode = (org?.vat_mode_default as VatMode | undefined) ?? null
  // Neplatiteľ nemôže fakturovať v režime platiteľa (ani v OSS).
  const defaultVatMode: VatMode = isVatPayer
    ? (orgVatMode ?? "payer")
    : orgVatMode && isZeroVatMode(orgVatMode)
      ? orgVatMode
      : "non_payer"
  const defaultVatRate = isVatPayer ? 23 : 0

  const today = todayIso()
  const system = [
    "Si asistent, ktorý z jednej slovenskej vety vytvorí podklad pre faktúru.",
    `Dnešný dátum je ${today} (formát YYYY-MM-DD). Relatívne dátumy (napr. „dnes“, „zajtra“) prepočítaj voči nemu.`,
    "Dátumy vždy vráť vo formáte YYYY-MM-DD, alebo null, ak ich používateľ neuviedol.",
    isVatPayer
      ? "Firma je platiteľ DPH. Ak je uvedené „+ DPH“ alebo „s DPH“, použi sadzbu DPH 23 %. Ak je cena „bez DPH“ alebo nie je o DPH zmienka, ponechaj sadzbu 23 % ako predvolenú."
      : "Firma NIE JE platiteľ DPH. Do každej položky daj sadzbu DPH 0 % a DPH nikdy nepripočítavaj — ani keď veta spomína „+ DPH“ alebo „s DPH“.",
    "Pri „splatnosť N dní“ nastav dueDate = issueDate + N dní. Ak issueDate chýba, počítaj od dnešného dátumu.",
    "Sumy ber ako cenu za jednotku (unitPrice) bez DPH, ak nie je uvedené inak.",
    "Mena je predvolene EUR. Položky (items) vyplň podľa popisu služby alebo tovaru z vety.",
    `vatMode nastav na '${defaultVatMode}', ak nie je zjavné inak.`,
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

  // Názov kontaktu → contactId cez skórovanie zhody. Pod prahom nepárujeme
  // vôbec — prázdny kontakt je lepší než cudzia firma na faktúre.
  let contactId: string | null = null
  if (draft.contactName && orgId) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", orgId)
    const match = matchContactByName(contacts ?? [], draft.contactName)
    contactId = match?.id ?? null
  }

  const issueDate = draft.issueDate || today
  const items =
    draft.items.length > 0
      ? draft.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          // Neplatiteľ DPH nesmie dostať nenulovú sadzbu, nech AI vráti čokoľvek.
          vatRate: isVatPayer ? i.vatRate : 0,
          discountPct: 0,
        }))
      : [
          {
            description: "",
            quantity: 1,
            unit: "ks",
            unitPrice: 0,
            vatRate: defaultVatRate,
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
    vatMode: isVatPayer ? draft.vatMode : defaultVatMode,
    items,
  }

  // Human-in-the-loop: ALWAYS a draft, never issue:true.
  const saved = await saveDocument(documentInput, { issue: false })
  if (!saved.ok) {
    return { ok: false, degraded: false, error: saved.error }
  }

  return { ok: true, id: saved.id }
}
