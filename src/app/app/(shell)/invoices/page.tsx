import Link from "next/link"
import { Plus, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: documents } = await supabase
    .from("documents")
    .select("*, contacts(name)")
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faktúry</h1>
          <p className="text-muted-foreground text-sm">
            Doklady a ich stav úhrady.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/invoices/new">
            <Plus className="size-4" />
            Nový doklad
          </Link>
        </Button>
      </div>

      {!documents || documents.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <FileText className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ žiadne doklady</p>
            <p className="text-muted-foreground text-sm">
              Vystav prvú faktúru.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/app/invoices/new">
              <Plus className="size-4" />
              Nový doklad
            </Link>
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Číslo</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Odberateľ</TableHead>
                <TableHead>Vystavené</TableHead>
                <TableHead className="text-right">Suma</TableHead>
                <TableHead>Stav</TableHead>
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
                        {d.number ?? "(koncept)"}
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
