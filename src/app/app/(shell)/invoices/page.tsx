import Link from "next/link"
import { Plus, FileText } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { formatMoney } from "@/lib/money"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/invoice/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Faktúry — Synapse Faktúra" }

// Prepinac nad tabulkou - najbeznejsie typy dokladov. Filter zvlada kazdu
// hodnotu enumu, ostatne typy sa daju otvorit priamym odkazom ?type=<hodnota>.
const FILTER_TYPES: DocumentType[] = [
  "invoice",
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
  return value in DOCUMENT_TYPE_LABELS ? (value as DocumentType) : null
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>
}) {
  const sp = await searchParams
  const activeType = parseType(sp.type)
  const t = await getTranslations("invoices")
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  // Bez aktivnej organizacie nezobrazujeme nic - vykresli sa prazdny stav
  const query = orgId
    ? supabase
        .from("documents")
        .select("*, contacts(name)")
        .eq("organization_id", orgId)
    : null
  // Bez parametra ostava zoznam nezmeneny - vypisu sa vsetky typy
  const { data: documents } = query
    ? await (activeType ? query.eq("type", activeType) : query).order(
        "created_at",
        { ascending: false },
      )
    : { data: null }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/app/invoices/new">
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
          <Link href="/app/invoices">Všetky</Link>
        </Button>
        {FILTER_TYPES.map((type) => (
          <Button
            key={type}
            asChild
            size="sm"
            variant={activeType === type ? "secondary" : "ghost"}
            aria-current={activeType === type ? "page" : undefined}
          >
            <Link href={`/app/invoices?type=${type}`}>
              {DOCUMENT_TYPE_LABELS[type]}
            </Link>
          </Button>
        ))}
      </nav>

      {!documents || documents.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <FileText className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">
              {activeType
                ? `Žiadne doklady typu „${DOCUMENT_TYPE_LABELS[activeType]}“`
                : t("emptyTitle")}
            </p>
            <p className="text-muted-foreground text-sm">
              {activeType
                ? `Vytvor nový doklad a zvoľ typ „${DOCUMENT_TYPE_LABELS[activeType]}“.`
                : t("emptyHint")}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/app/invoices/new">
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
