"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  FileCode,
  Send,
  ShieldCheck,
  Download,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import {
  previewEInvoice,
  sendEInvoice,
  getEInvoice,
  type EInvoiceRow,
} from "@/app/actions/einvoice"
import { useUpgrade } from "@/components/billing/upgrade-dialog"
import type {
  ValidationResult,
  ValidationError,
  EinvoiceTransportStatus,
} from "@/lib/peppol/types"

const TRANSPORT_META: Record<
  EinvoiceTransportStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queued: { label: "V poradí", variant: "secondary" },
  sent: { label: "Odoslaná", variant: "default" },
  delivered: { label: "Doručená", variant: "default" },
  failed: { label: "Zlyhala", variant: "destructive" },
  received: { label: "Prijatá", variant: "secondary" },
}

/** Invoice number lives in the first cbc:ID after cbc:ProfileID (BT-1). */
function invoiceNumberFromXml(xml: string): string | null {
  const ids = [...xml.matchAll(/<cbc:ID>([^<]*)<\/cbc:ID>/g)]
  return ids[0]?.[1]?.trim() || null
}

function downloadXml(xml: string, fileName: string) {
  const blob = new Blob([xml], { type: "application/xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function ErrorRow({ error }: { error: ValidationError }) {
  const isError = error.severity === "error"
  const Icon = isError ? XCircle : AlertTriangle
  const tone = isError
    ? "text-destructive"
    : "text-amber-600 dark:text-amber-400"
  return (
    <li className="border-border flex items-start gap-3 rounded-md border p-3">
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <p className="text-foreground min-w-0 text-sm">
        <span className="font-medium">{error.rule}</span>
        {" — "}
        {error.message}
      </p>
    </li>
  )
}

function ValidationView({ validation }: { validation: ValidationResult }) {
  if (validation.valid && validation.errors.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-4" />
        Doklad je platná e-faktúra.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {validation.errors.map((e, i) => (
        <ErrorRow key={i} error={e} />
      ))}
    </ul>
  )
}

export function EInvoicePanel({
  documentId,
  enabled,
  status,
}: {
  documentId: string
  enabled: boolean
  status: string
}) {
  const [existing, setExisting] = useState<EInvoiceRow | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [loadingState, startLoadState] = useTransition()
  const [validating, startValidate] = useTransition()
  const [sending, startSend] = useTransition()
  const [downloading, startDownload] = useTransition()
  const { prompt } = useUpgrade()

  useEffect(() => {
    if (!enabled) return
    startLoadState(async () => {
      const row = await getEInvoice(documentId)
      setExisting(row)
    })
  }, [documentId, enabled])

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="text-muted-foreground size-5" />
            E-faktúra (Peppol)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            E-fakturácia nie je zapnutá. Zapnite ju v{" "}
            <Link href="/app/settings" className="text-primary underline">
              Nastaveniach
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  const isDraft = status === "draft"

  function runValidate() {
    startValidate(async () => {
      const res = await previewEInvoice(documentId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setValidation(res.validation)
    })
  }

  function runSend() {
    startSend(async () => {
      const res = await sendEInvoice(documentId)
      if (!res.ok) {
        if (res.validation) setValidation(res.validation)
        if (res.upgrade) prompt(res.upgrade, res.error)
        else toast.error(res.error)
        return
      }
      toast.success("E-faktúra odoslaná")
      const row = await getEInvoice(documentId)
      setExisting(row)
    })
  }

  function runDownload() {
    startDownload(async () => {
      const res = await previewEInvoice(documentId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const number = invoiceNumberFromXml(res.xml) ?? documentId
      downloadXml(res.xml, `${number}.xml`)
    })
  }

  const transport = existing
    ? TRANSPORT_META[existing.transport_status]
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="text-muted-foreground size-5" />
          E-faktúra (Peppol)
        </CardTitle>
        <CardDescription>
          Vytvorte, overte a odošlite elektronickú faktúru cez Peppol.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingState ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Načítavam stav…
          </p>
        ) : transport ? (
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Stav prenosu</span>
              <Badge variant={transport.variant}>{transport.label}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Stiahnuť XML
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={runValidate}
            disabled={validating}
          >
            {validating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Overiť
          </Button>

          <Button
            onClick={runSend}
            disabled={sending || isDraft}
            title={
              isDraft
                ? "Koncept sa odoslať nedá — najprv doklad vystav."
                : undefined
            }
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Odoslať e-faktúru
          </Button>

          {!transport ? (
            <Button
              variant="outline"
              onClick={runDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Stiahnuť XML
            </Button>
          ) : null}
        </div>

        {isDraft ? (
          <p className="text-muted-foreground text-xs">
            Doklad je v stave návrh. Najprv ho vystavte, potom môžete odoslať
            e-faktúru.
          </p>
        ) : null}

        {validation ? <ValidationView validation={validation} /> : null}
      </CardContent>
    </Card>
  )
}
