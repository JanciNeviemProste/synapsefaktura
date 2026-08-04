import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
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

/** Rozparsuje YYYY-MM-DD na rok a mesiac. Vrati null pri neplatnom tvare. */
function parseYearMonth(date: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
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
  // Export musi ist za AKTIVNU organizaciu, nie za prvu, ktoru vrati RLS.
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return new Response("Nemáš aktívnu firmu — export nie je možný.", {
      status: 400,
    })
  }
  const { data: org } = await supabase
    .from("organizations")
    .select("name, ico, dic, ic_dph")
    .eq("id", orgId)
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
      supabase.from("contacts").select("*").eq("organization_id", orgId),
      supabase.from("products").select("*").eq("organization_id", orgId),
      supabase.from("documents").select("*").eq("organization_id", orgId),
      // document_items a payments nemaju organization_id - scopuju sa cez rodica.
      supabase.from("document_items").select("*"),
      supabase.from("expenses").select("*").eq("organization_id", orgId),
      supabase.from("payments").select("*"),
      supabase
        .from("bank_transactions")
        .select("*")
        .eq("organization_id", orgId),
      supabase
        .from("recurring_invoices")
        .select("*")
        .eq("organization_id", orgId),
      supabase.from("reminders").select("*").eq("organization_id", orgId),
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
    .eq("organization_id", orgId)
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
  // Perioda vykazu sa musi odvodit z CELEHO rozsahu. Ked sa berie len z "from",
  // rozsah 1.1.-31.12. ticho vyrobi vykaz oznaceny ako januar s celorocnymi datami.
  const fromPeriod = parseYearMonth(from)
  const toPeriod = parseYearMonth(to)

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
    case "kontrolny-vykaz": {
      // Kontrolny vykaz sa podava za jeden kalendarny mesiac.
      if (
        !fromPeriod ||
        !toPeriod ||
        fromPeriod.year !== toPeriod.year ||
        fromPeriod.month !== toPeriod.month
      ) {
        return new Response(
          "Kontrolný výkaz sa podáva za jeden kalendárny mesiac. Nastav obdobie od prvého do posledného dňa toho istého mesiaca.",
          { status: 400 },
        )
      }
      return file(
        buildKontrolnyVykaz(exportOrg, invoices, fromPeriod),
        "application/xml",
        `kontrolny-vykaz-${fromPeriod.year}-${fromPeriod.month}.xml`,
      )
    }
    case "suhrnny-vykaz": {
      // Suhrnny vykaz sa podava za jeden mesiac alebo stvrtrok - rozsah teda
      // nesmie presiahnut jeden stvrtrok, inak by hlavicka klamala.
      if (
        !fromPeriod ||
        !toPeriod ||
        fromPeriod.year !== toPeriod.year ||
        Math.ceil(fromPeriod.month / 3) !== Math.ceil(toPeriod.month / 3)
      ) {
        return new Response(
          "Súhrnný výkaz sa podáva za jeden mesiac alebo štvrťrok. Nastav obdobie v rámci jedného štvrťroka.",
          { status: 400 },
        )
      }
      return file(
        buildSuhrnnyVykaz(exportOrg, invoices, fromPeriod),
        "application/xml",
        `suhrnny-vykaz-${fromPeriod.year}.xml`,
      )
    }
    default:
      return new Response("Neznámy typ exportu.", { status: 400 })
  }
}
