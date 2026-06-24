import { createClient } from "@/lib/supabase/server"
import {
  buildAccountingCsv,
  buildAccountingXml,
  type ExportInvoice,
} from "@/lib/export/accounting"
import {
  buildKontrolnyVykaz,
  buildSuhrnnyVykaz,
  type ExportOrg,
} from "@/lib/export/fs-sr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function file(body: string, contentType: string, name: string): Response {
  return new Response(body, {
    headers: {
      "content-type": `${contentType}; charset=utf-8`,
      "content-disposition": `attachment; filename="${name}"`,
    },
  })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  const url = new URL(req.url)
  const now = new Date()
  const from = url.searchParams.get("from") ?? `${now.getFullYear()}-01-01`
  const to = url.searchParams.get("to") ?? now.toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data: org } = await supabase
    .from("organizations")
    .select("name, ico, dic, ic_dph")
    .limit(1)
    .maybeSingle()
  if (!org) return new Response("Chýba firma.", { status: 404 })

  // GDPR: full org data dump.
  if (type === "gdpr") {
    const [
      contacts,
      products,
      documents,
      items,
      expenses,
      payments,
      bank,
      recurring,
      reminders,
    ] = await Promise.all([
      supabase.from("contacts").select("*"),
      supabase.from("products").select("*"),
      supabase.from("documents").select("*"),
      supabase.from("document_items").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("bank_transactions").select("*"),
      supabase.from("recurring_invoices").select("*"),
      supabase.from("reminders").select("*"),
    ])
    const dump = {
      exportedAt: now.toISOString(),
      organization: org,
      contacts: contacts.data ?? [],
      products: products.data ?? [],
      documents: documents.data ?? [],
      document_items: items.data ?? [],
      expenses: expenses.data ?? [],
      payments: payments.data ?? [],
      bank_transactions: bank.data ?? [],
      recurring_invoices: recurring.data ?? [],
      reminders: reminders.data ?? [],
    }
    return file(
      JSON.stringify(dump, null, 2),
      "application/json",
      `export-udajov-${to}.json`,
    )
  }

  // Invoice-based exports.
  const { data: docs } = await supabase
    .from("documents")
    .select("*, contacts(name, ico, ic_dph)")
    .eq("type", "invoice")
    .gte("issue_date", from)
    .lte("issue_date", to)
    .order("issue_date")

  const invoices: ExportInvoice[] = (docs ?? []).map((d) => {
    const c = d.contacts as {
      name?: string
      ico?: string
      ic_dph?: string
    } | null
    return {
      number: d.number,
      issue_date: d.issue_date,
      supply_date: d.supply_date,
      due_date: d.due_date,
      currency: d.currency,
      subtotal: d.subtotal,
      vat_total: d.vat_total,
      total: d.total,
      status: d.status,
      vat_mode: d.vat_mode,
      contactName: c?.name ?? null,
      contactIco: c?.ico ?? null,
      contactIcDph: c?.ic_dph ?? null,
    }
  })

  const exportOrg: ExportOrg = {
    name: org.name,
    ico: org.ico,
    dic: org.dic,
    icDph: org.ic_dph,
  }
  const [y, m] = from.split("-").map(Number)
  const period = { year: y || now.getFullYear(), month: m || 1 }

  switch (type) {
    case "accounting-csv":
      return file(
        buildAccountingCsv(invoices),
        "text/csv",
        `uctovny-export-${to}.csv`,
      )
    case "accounting-xml":
      return file(
        buildAccountingXml(invoices),
        "application/xml",
        `uctovny-export-${to}.xml`,
      )
    case "kontrolny-vykaz":
      return file(
        buildKontrolnyVykaz(exportOrg, invoices, period),
        "application/xml",
        `kontrolny-vykaz-${period.year}-${period.month}.xml`,
      )
    case "suhrnny-vykaz":
      return file(
        buildSuhrnnyVykaz(exportOrg, invoices, period),
        "application/xml",
        `suhrnny-vykaz-${period.year}.xml`,
      )
    default:
      return new Response("Neznámy typ exportu.", { status: 400 })
  }
}
