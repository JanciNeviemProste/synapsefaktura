import Link from "next/link"
import { Plus, FileText } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { formatMoney } from "@/lib/money"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/invoice/status-badge"
import { TagFilter } from "@/components/tags/tag-filter"
import { listTags, taggedEntityIds } from "@/app/actions/tags"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Faktúry — Synapse Faktúra" }

// Prepinac nad tabulkou. Filter zvlada kazdu hodnotu enumu; tu su tie, ktore
// zivnostnik realne pouziva.
//
// `proforma` a `tax_doc_payment` tu chybali, hoci su plne postavene — zalohova
// faktura je pritom bezna vec a pouzivatel sa k jej zoznamu dostal len rucne
// napisanym `?type=proforma`. Zvysne typy (`advance`, `order_issued`,
// `order_received`, `draft`) zamerne v prepinaci nie su, aby sa z neho nestal
// zoznam desiatich tlacidiel — otvoria sa priamym odkazom.
const FILTER_TYPES: DocumentType[] = [
  "invoice",
  "proforma",
  "tax_doc_payment",
  "quote",
  "delivery_note",
  "credit_note",
]

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

// Neznamy alebo chybajuci parameter znamena "vsetky doklady"
function parseType(value: string | string[] | undefined): DocumentType | null {
  if (typeof value !== "string") return null
  // `in` prehlada aj prototyp, takze ?type=toString alebo ?type=constructor by
  // presli ako platny typ dokladu. Dotaz by potom spadol na neplatnej hodnote
  // enumu a stranka by vypisala "Ziadne doklady typu function toString()...".
  return Object.hasOwn(DOCUMENT_TYPE_LABELS, value)
    ? (value as DocumentType)
    : null
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; tag?: string | string[] }>
}) {
  const sp = await searchParams
  const activeType = parseType(sp.type)
  const activeTagId = typeof sp.tag === "string" ? sp.tag : null
  const t = await getTranslations("invoices")
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  const [tags, taggedIds] = await Promise.all([
    listTags(),
    taggedEntityIds("document", activeTagId ?? undefined),
  ])

  // Bez aktivnej organizacie nezobrazujeme nic - vykresli sa prazdny stav
  let query = orgId
    ? supabase
        .from("documents")
        .select("*, contacts(name)")
        .eq("organization_id", orgId)
    : null
  // Bez parametra ostava zoznam nezmeneny - vypisu sa vsetky typy
  if (query && activeType) query = query.eq("type", activeType)
  // `taggedIds === null` znamena "bez filtra", `[]` znamena "nic nevyhovuje".
  if (query && taggedIds) query = query.in("id", taggedIds)

  const { data: documents } = query
    ? await query.order("created_at", { ascending: false })
    : { data: null }

  const activeTag = tags.find((t) => t.id === activeTagId) ?? null

  // Nadpis musi povedat, na co sa pouzivatel prave pozera. Doteraz tu bolo
  // natvrdo „Faktury" aj vtedy, ked bol zoznam vyfiltrovany na cenove ponuky
  // — filter zabral, ale na obrazovke to nebolo vidiet.
  const heading = activeType ? DOCUMENT_TYPE_LABELS[activeType] : t("title")

  // Typ sa nesie do noveho dokladu. Bez toho vznikla z „Dodacie listy →
  // Novy doklad" faktura a pouzivatel to musel prepinat az v doklade.
  const newDocHref = activeType
    ? `/app/invoices/new?type=${activeType}`
    : "/app/invoices/new"

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[clamp(24px,3.2vw,34px)] leading-tight tracking-tight">{heading}</h1>
          <p className="text-muted-foreground text-sm">
            {activeType
              ? `Zoznam dokladov typu „${DOCUMENT_TYPE_LABELS[activeType]}“.`
              : t("subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href={newDocHref}>
            <Plus className="size-4" />
            {t("newDoc")}
          </Link>
        </Button>
      </div>

      <nav
        aria-label="Filter podľa typu dokladu"
        className="flex flex-wrap gap-1"
      >
        <Button
          asChild
          size="sm"
          variant={activeType ? "ghost" : "secondary"}
          aria-current={activeType ? undefined : "page"}
        >
          <Link
            href={activeTagId ? `/app/invoices?tag=${activeTagId}` : "/app/invoices"}
          >
            Všetky
          </Link>
        </Button>
        {FILTER_TYPES.map((type) => (
          <Button
            key={type}
            asChild
            size="sm"
            variant={activeType === type ? "secondary" : "ghost"}
            aria-current={activeType === type ? "page" : undefined}
          >
            <Link
              href={
                activeTagId
                  ? `/app/invoices?type=${type}&tag=${activeTagId}`
                  : `/app/invoices?type=${type}`
              }
            >
              {DOCUMENT_TYPE_LABELS[type]}
            </Link>
          </Button>
        ))}
      </nav>

      <TagFilter
        tags={tags}
        activeTagId={activeTagId}
        basePath="/app/invoices"
        keep={{ type: activeType ?? undefined }}
      />

      {!documents || documents.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <FileText className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">
              {activeTag
                ? `Žiadne doklady so štítkom „${activeTag.name}“`
                : activeType
                  ? `Žiadne doklady typu „${DOCUMENT_TYPE_LABELS[activeType]}“`
                  : t("emptyTitle")}
            </p>
            <p className="text-muted-foreground text-sm">
              {activeTag
                ? "Štítok priradíš na detaile dokladu."
                : activeType
                  ? `Vytvor nový doklad a zvoľ typ „${DOCUMENT_TYPE_LABELS[activeType]}“.`
                  : t("emptyHint")}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={newDocHref}>
              <Plus className="size-4" />
              {t("newDoc")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colNumber")}</TableHead>
                <TableHead>{t("colType")}</TableHead>
                <TableHead>{t("colCustomer")}</TableHead>
                <TableHead>{t("colIssued")}</TableHead>
                <TableHead className="text-right">{t("colAmount")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d) => {
                const contactName =
                  (d.contacts as { name?: string } | null)?.name ?? "—"
                return (
                  <TableRow key={d.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/app/invoices/${d.id}`}
                        className="hover:underline"
                      >
                        {d.number ?? t("draft")}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {DOCUMENT_TYPE_LABELS[d.type as DocumentType] ?? d.type}
                    </TableCell>
                    <TableCell>{contactName}</TableCell>
                    <TableCell>{fmtDate(d.issue_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(d.total, d.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
