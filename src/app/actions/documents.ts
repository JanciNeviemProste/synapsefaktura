"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { newPriceListEntries } from "@/lib/documents/price-list"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { documentSchema, type DocumentInput } from "@/lib/validation/document"
import {
  checkConversion,
  conversionQuantitySign,
} from "@/lib/documents/convert"
import { variableSymbolFromNumber } from "@/lib/documents/variable-symbol"
import {
  buildClientSnapshot,
  type ClientSnapshot,
} from "@/lib/documents/client-snapshot"
import type { DocumentType } from "@/lib/documents/labels"
import { computeInvoice } from "@/lib/vat/engine"
import { legalNoteForVatMode } from "@/lib/vat/legal-notes"
import { gateDocumentIssue } from "@/lib/billing/gate"
import type { PlanTier } from "@/lib/billing/plans"
import { renderInvoicePdf } from "@/lib/pdf/render"
import { hasEmail, sendEmail } from "@/lib/email/provider"
import { invoiceEmail } from "@/lib/email/templates"
import { formatMoney } from "@/lib/money"

export type SaveDocumentResult =
  | { ok: true; id: string }
  | { ok: false; error: string; upgrade?: PlanTier }

export async function saveDocument(
  input: DocumentInput,
  opts: { id?: string; issue?: boolean } = {},
): Promise<SaveDocumentResult> {
  const parsed = documentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // Recompute totals server-side — never trust amounts from the client.
  const computed = computeInvoice(
    v.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
      discountPct: i.discountPct,
    })),
    v.vatMode,
  )

  const lang = v.language === "en" ? "en" : "sk"
  const legalNote = legalNoteForVatMode(v.vatMode, lang)

  // Determine number / status. Assign a number atomically on first issue.
  let number: string | null = null
  let status: "draft" | "issued" = "draft"
  let wasIssued = false
  let existingVariableSymbol: string | null = null

  if (opts.id) {
    const { data: existing } = await supabase
      .from("documents")
      .select("number, status, variable_symbol")
      .eq("id", opts.id)
      .eq("organization_id", orgId)
      .maybeSingle()
    number = existing?.number ?? null
    status = (existing?.status as "draft" | "issued") ?? "draft"
    wasIssued = existing?.status === "issued"
    existingVariableSymbol = existing?.variable_symbol ?? null
  }

  // Plan limit applies to every first transition to "issued" (not re-saves of an
  // already-issued doc), regardless of whether a number was pre-assigned.
  if (opts.issue && !wasIssued) {
    const g = await gateDocumentIssue(supabase, orgId)
    if (!g.allowed) {
      return { ok: false, error: g.reason, upgrade: g.requiredTier }
    }
  }

  if (opts.issue && !number) {
    const year = Number(v.issueDate.slice(0, 4))
    const { data: assigned, error: numErr } = await supabase.rpc(
      "next_document_number",
      { p_org: orgId, p_doc_type: v.type, p_year: year },
    )
    if (numErr) return { ok: false, error: "Nepodarilo sa prideliť číslo." }
    number = assigned
    status = "issued"
  } else if (opts.issue) {
    status = "issued"
  }

  // Prechod draft -> issued. Len tu sa doplna variabilny symbol a snapshot
  // odberatela — na uz vystavenom doklade su obidve nemenne.
  const isIssuing = Boolean(opts.issue) && !wasIssued

  // VS odvodzujeme z prideleneho cisla rovnako, ako to robi PDF a parovanie
  // uhrad. Uz vyplneny symbol NEPREPISUJEME — odberatel ho ma na doklade,
  // ktory mu uz odisiel, a zmena by rozbila parovanie platby.
  const variableSymbol =
    isIssuing && !existingVariableSymbol
      ? variableSymbolFromNumber(number)
      : null

  // Snapshot sa v DB zmrazuje triggerom `freeze_client_snapshot` — druhy zapis
  // vyhodi vynimku. Preto ho zostavujeme vylucne pri vystaveni a do UPDATE ho
  // pri dalsich ulozeniach vobec neposielame.
  let clientSnapshot: ClientSnapshot | null = null
  if (isIssuing && v.contactId) {
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      // POZN.: `iban`/`swift` na `contacts` zatial neexistuju — snapshot ich
      // drzi ako null, aby mal stabilny tvar, ked stlpce pribudnu.
      .select(
        "name, ico, dic, ic_dph, street, city, postal_code, country, email, phone",
      )
      .eq("id", v.contactId)
      .eq("organization_id", orgId)
      .maybeSingle()
    if (contactErr || !contact) {
      // Nefatalne: doklad sa vystavi aj bez snapshotu (stlpec je nullable a
      // udaje sa dovtedy citaju zivo z contacts), ale chceme o tom vediet.
      console.error(
        "[saveDocument] snapshot odberatela sa nepodarilo zostavit",
        {
          documentId: opts.id,
          phase: "contacts:snapshot",
          contactId: v.contactId,
          error: contactErr?.message ?? "kontakt sa nenasiel",
        },
      )
    } else {
      clientSnapshot = buildClientSnapshot(contact)
    }
  }

  const docRow = {
    organization_id: orgId,
    type: v.type,
    number,
    contact_id: v.contactId ?? null,
    issue_date: v.issueDate,
    supply_date: v.supplyDate || null,
    due_date: v.dueDate || null,
    currency: v.currency,
    exchange_rate: v.exchangeRate,
    language: v.language,
    vat_mode: v.vatMode,
    status,
    subtotal: computed.subtotal,
    vat_total: computed.vatTotal,
    total: computed.total,
    notes: v.notes || null,
    footer_notes: v.footerNotes || null,
    legal_notes: legalNote,
    // Vazbu zapisujeme len ked ju volajuci posle — inak by kazde ulozenie
    // z editora prepisalo existujuci related_document_id na null.
    ...(v.relatedDocumentId !== undefined
      ? { related_document_id: v.relatedDocumentId }
      : {}),
    // Prepinac cien sa zapise len ked ho formular naozaj poslal. Bez tejto
    // podmienky by kazde ulozenie z ineho miesta (prevod, cron) prepisalo
    // vedome nastavenie na hodnotu odvodenu z typu.
    ...(v.showPrices !== undefined ? { show_prices: v.showPrices } : {}),
    // Rovnaky dovod ako vyssie: oba stlpce sa zapisuju len pri vystaveni.
    // Pri snapshote to nie je len opatrnost — opakovany zapis odmietne DB
    // trigger a spadla by cela akcia.
    ...(variableSymbol ? { variable_symbol: variableSymbol } : {}),
    ...(clientSnapshot ? { client_snapshot: clientSnapshot } : {}),
  }

  const itemRows = computed.lines.map((line, idx) => ({
    position: idx,
    description: v.items[idx].description ?? "",
    quantity: line.quantity,
    unit: v.items[idx].unit ?? "ks",
    unit_price: line.unitPrice,
    vat_rate: line.effectiveVatRate,
    discount_pct: line.discountPct,
    line_base: line.lineBase,
    line_vat: line.lineVat,
    line_total: line.lineTotal,
    product_id: v.items[idx].productId ?? null,
    // Uctovne clenenie sedi na POLOZKE — jeden doklad moze niest riadky
    // z roznych stredisk. Prazdne pole ide ako `null`, nie ako prazdny
    // retazec: export by inak uctovnikovi posielal stlpec, ktory vyzera
    // vyplneny, ale nic nenesie.
    account_code: v.items[idx].accountCode || null,
    cost_center: v.items[idx].costCenter || null,
    project_code: v.items[idx].projectCode || null,
    activity_code: v.items[idx].activityCode || null,
  }))

  // Hlavicka aj polozky idu do DB jednym volanim, ktore je na strane Postgresu
  // jedna transakcia. Ked cokolvek zlyha, nezostane po nom nic — ziadna zaloha
  // poloziek v pamati ani uklid rozrobeneho dokladu uz netreba.
  // POZN.: cislo pridelene cez `next_document_number` sa pri zlyhani NEVRACIA
  // (citac sa inkrementuje vo vlastnej transakcii uz predtym), takze v ciselnom
  // rade moze vzniknut diera. To je zamer: precislovavanie uz vystavenych
  // dokladov by bolo horsie ako medzera.
  // Service-role klient je tu NUTNY, nie pohodlnost: funkcia je odobrata
  // beznym pouzivatelom (20260805090000_lock_save_document_rpc.sql), lebo je
  // `security definer` a doveruje zoznamu stlpcov od volajuceho — cez PostgREST
  // by si klient nastavil `total`, `paid_amount` aj `status` sam.
  //
  // Org scoping tym netrpi: `docRow.organization_id` je `orgId` z overeneho
  // `getCurrentOrgId`, nie z requestu, a funkcia pri UPDATE filtruje
  // `where d.id = ... and d.organization_id = ...`, takze cudzi doklad
  // nezasiahne. Klientovy vstup sa sem dostane az po prepocte cez `computeInvoice`.
  const admin = createAdminClient()
  const { data: savedId, error: saveErr } = await admin.rpc(
    "save_document_with_items",
    {
      p_document: docRow,
      p_items: itemRows,
      ...(opts.id ? { p_id: opts.id } : {}),
    },
  )
  if (saveErr || !savedId) {
    console.error("[saveDocument] atomicky zapis dokladu zlyhal", {
      documentId: opts.id,
      phase: "rpc:save_document_with_items",
      mode: opts.id ? "update" : "create",
      itemCount: itemRows.length,
      number,
      error: saveErr?.message,
    })
    return {
      ok: false,
      error: opts.id
        ? "Doklad sa nepodarilo uložiť."
        : "Doklad sa nepodarilo vytvoriť.",
    }
  }

  // Polozky, ktore v cenniku este nie su, sa don doplnia — aby ich appka
  // nabuduce ponukla. Cennik je na to spravne miesto: je editovatelny,
  // viditelny a uz dnes sluzi ako zdroj pre „Pridat z cennika".
  //
  // Zlyhanie sa NEHLASI ako chyba ulozenia. Doklad je ulozeny a to je to
  // podstatne; nedoplneny cennik je nepohodlie, nie strata.
  await addItemsToPriceList(supabase, orgId, v.items)

  revalidatePath("/app/invoices")
  return { ok: true, id: savedId }
}

/**
 * Doplni cennik o polozky, ktore v nom este nie su.
 *
 * Porovnava sa normalizovany nazov (bez okrajovych medzier, jedna medzera,
 * male pismena), takze „Doprava" a „doprava  " su ta ista polozka a cennik sa
 * nezaplni variantmi.
 */
async function addItemsToPriceList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  items: ReturnType<typeof documentSchema.parse>["items"],
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("products")
      .select("name")
      .eq("organization_id", orgId)

    const entries = newPriceListEntries(
      items.map((i) => ({
        description: i.description ?? "",
        unit: i.unit ?? "ks",
        unitPrice: Number(i.unitPrice) || 0,
        vatRate: Number(i.vatRate) || 0,
      })),
      (existing ?? []).map((p) => p.name),
    )
    if (entries.length === 0) return

    const { error } = await supabase
      .from("products")
      .insert(entries.map((e) => ({ organization_id: orgId, ...e })))
    if (error) {
      console.error("[saveDocument] cennik sa nepodarilo doplnit", {
        organizationId: orgId,
        count: entries.length,
        error: error.message,
      })
      return
    }
    revalidatePath("/app/products")
  } catch (e) {
    console.error("[saveDocument] cennik sa nepodarilo doplnit", {
      organizationId: orgId,
      error: e instanceof Error ? e.message : "neznama chyba",
    })
  }
}

export async function deleteDocument(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) return { ok: false, error: "Doklad sa nepodarilo zmazať." }
  revalidatePath("/app/invoices")
  return { ok: true }
}

/** Records full payment and marks the document paid. */
export async function markAsPaid(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("documents")
    .select("total")
    .eq("id", id)
    .maybeSingle()
  if (!doc) return { ok: false, error: "Doklad sa nenašiel." }

  await supabase
    .from("payments")
    .insert({ document_id: id, amount: doc.total, method: "bank" })
  const { error } = await supabase
    .from("documents")
    .update({ status: "paid", paid_amount: doc.total })
    .eq("id", id)
  if (error) return { ok: false, error: "Nepodarilo sa označiť ako uhradené." }
  revalidatePath("/app/invoices")
  revalidatePath(`/app/invoices/${id}`)
  return { ok: true }
}

/**
 * Emails the invoice (PDF attached) to the contact and marks it sent.
 *
 * `delivered` reflects whether an email actually went out: false when no email
 * key is configured or the contact has no address (the doc is still marked sent
 * so the workflow proceeds). A genuine send failure does NOT flip the status —
 * we surface the error so the user can retry (no silent failure).
 */
export async function markAsSent(
  id: string,
): Promise<{ ok: boolean; error?: string; delivered?: boolean }> {
  const supabase = await createClient()

  // Organizaciu posielame aj tu: RLS pusti vsetky organizacie pouzivatela,
  // takze bez nej by odberatel mohol dostat fakturu s hlavickou a IBAN-om
  // druhej firmy, ktorej je odosielatel clenom.
  const orgId = await getCurrentOrgId(supabase)
  const rendered = await renderInvoicePdf(supabase, id, orgId ?? undefined)
  if (!rendered) return { ok: false, error: "Doklad sa nenašiel." }
  const { buffer, doc, contact, org } = rendered

  let delivered = false
  if (hasEmail() && contact?.email) {
    const { subject, html } = invoiceEmail({
      lang: doc.language,
      docNumber: doc.number ?? "—",
      supplierName: org.name,
      customerName: contact.name,
      total: formatMoney(doc.total, doc.currency),
      dueDate: doc.due_date
        ? doc.due_date.split("-").reverse().join(".")
        : "—",
    })
    const res = await sendEmail({
      to: contact.email,
      subject,
      html,
      attachments: [
        { filename: `${doc.number ?? "faktura"}.pdf`, content: buffer },
      ],
    })
    if (!res.ok && !res.skipped) {
      return { ok: false, error: "E-mail sa nepodarilo odoslať. Skús znova." }
    }
    delivered = res.ok
  }

  const { error } = await supabase
    .from("documents")
    .update({ status: "sent" })
    .eq("id", id)
  if (error) return { ok: false, error: "Nepodarilo sa označiť ako odoslané." }
  revalidatePath(`/app/invoices/${id}`)
  return { ok: true, delivered }
}

/** Duplicates a document (and its items) as a fresh draft without a number. */
export async function duplicateDocument(
  id: string,
): Promise<SaveDocumentResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: src } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!src) return { ok: false, error: "Doklad sa nenašiel." }

  const { data: srcItems } = await supabase
    .from("document_items")
    .select("*")
    .eq("document_id", id)
    .order("position")

  const { data: created, error } = await supabase
    .from("documents")
    .insert({
      organization_id: orgId,
      type: src.type,
      number: null,
      contact_id: src.contact_id,
      issue_date: src.issue_date,
      supply_date: src.supply_date,
      due_date: src.due_date,
      currency: src.currency,
      exchange_rate: src.exchange_rate,
      language: src.language,
      vat_mode: src.vat_mode,
      status: "draft",
      subtotal: src.subtotal,
      vat_total: src.vat_total,
      total: src.total,
      notes: src.notes,
      footer_notes: src.footer_notes,
      legal_notes: src.legal_notes,
    })
    .select("id")
    .single()
  if (error || !created)
    return { ok: false, error: "Doklad sa nepodarilo duplikovať." }

  if (srcItems?.length) {
    await supabase.from("document_items").insert(
      srcItems.map((it) => ({
        document_id: created.id,
        position: it.position,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        discount_pct: it.discount_pct,
        line_base: it.line_base,
        line_vat: it.line_vat,
        line_total: it.line_total,
        product_id: it.product_id,
      })),
    )
  }

  revalidatePath("/app/invoices")
  return { ok: true, id: created.id }
}

/**
 * Converts a document to another type (quote -> invoice, invoice -> credit
 * note, ...). The new document is always a DRAFT without a number: the user
 * checks it and issues it himself. The source is left untouched — the only
 * trace is `related_document_id` on the new document.
 *
 * Writing goes through `saveDocument`, so totals are recomputed and the legal
 * note is derived exactly like on any other save.
 */
export async function convertDocument(
  sourceId: string,
  targetType: DocumentType,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data: src } = await supabase
    .from("documents")
    .select("*")
    .eq("id", sourceId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!src) return { ok: false, error: "Doklad sa nenašiel." }

  const allowed = checkConversion(src.type, targetType)
  if (!allowed.ok) return allowed

  const { data: srcItems } = await supabase
    .from("document_items")
    .select("*")
    .eq("document_id", sourceId)
    .order("position")
  if (!srcItems?.length) {
    return { ok: false, error: "Doklad nemá žiadne položky na prevedenie." }
  }

  // Novy doklad vznika dnes; datum dodania a splatnost si doplni pouzivatel
  // v editore — prenasat ich zo zdroja by dalo faktúre splatnost ponuky.
  const today = new Date().toISOString().slice(0, 10)

  const sign = conversionQuantitySign(targetType)

  return saveDocument({
    type: targetType,
    contactId: src.contact_id,
    issueDate: today,
    currency: src.currency,
    exchangeRate: src.exchange_rate,
    language: src.language,
    vatMode: src.vat_mode,
    notes: src.notes ?? "",
    footerNotes: src.footer_notes ?? "",
    relatedDocumentId: sourceId,
    items: srcItems.map((it) => ({
      description: it.description,
      quantity: sign * it.quantity,
      unit: it.unit,
      unitPrice: it.unit_price,
      vatRate: it.vat_rate,
      discountPct: it.discount_pct,
      productId: it.product_id,
    })),
  })
}
