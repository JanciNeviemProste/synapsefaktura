import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import { StatusBadge } from "@/components/invoice/status-badge"
import { DocumentActions } from "@/components/invoice/document-actions"
import { CompliancePanel } from "@/components/invoice/compliance-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Doklad — Synapse Faktúra" }

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: doc }, { data: items }] = await Promise.all([
    supabase
      .from("documents")
      .select("*, contacts(name, ic_dph)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("document_items")
      .select("*")
      .eq("document_id", id)
      .order("position"),
  ])

  if (!doc) notFound()

  const contact = doc.contacts as { name?: string; ic_dph?: string } | null
  const title = DOCUMENT_TYPE_LABELS[doc.type as DocumentType] ?? "Doklad"

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {title} {doc.number ?? "(koncept)"}
            </h1>
            <StatusBadge status={doc.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {contact?.name ?? "Bez odberateľa"}
          </p>
        </div>
        <DocumentActions id={doc.id} status={doc.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Doklad</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Dátum vystavenia" value={fmtDate(doc.issue_date)} />
          <Field
            label="Dátum dodania (DUZP)"
            value={fmtDate(doc.supply_date)}
          />
          <Field label="Splatnosť" value={fmtDate(doc.due_date)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Položky</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Popis</TableHead>
                <TableHead className="text-right">Množstvo</TableHead>
                <TableHead className="text-right">Cena/j.</TableHead>
                <TableHead className="text-right">DPH</TableHead>
                <TableHead className="text-right">Základ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.description || "—"}</TableCell>
                  <TableCell className="text-right">
                    {it.quantity} {it.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(it.unit_price, doc.currency)}
                  </TableCell>
                  <TableCell className="text-right">{it.vat_rate} %</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(it.line_base, doc.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 grid justify-items-end gap-1">
            <Row
              label="Základ spolu"
              value={formatMoney(doc.subtotal, doc.currency)}
            />
            <Row
              label="DPH spolu"
              value={formatMoney(doc.vat_total, doc.currency)}
            />
            <div className="flex w-full max-w-xs justify-between border-t pt-1 text-base font-semibold">
              <span>Spolu na úhradu</span>
              <span className="tabular-nums">
                {formatMoney(doc.total, doc.currency)}
              </span>
            </div>
          </div>

          {doc.legal_notes ? (
            <p className="text-muted-foreground mt-4 text-sm italic">
              {doc.legal_notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <CompliancePanel documentId={doc.id} />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-muted-foreground flex w-full max-w-xs justify-between text-sm">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
