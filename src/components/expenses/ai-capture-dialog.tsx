"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Paperclip } from "lucide-react"
import { toast } from "sonner"

import type { ExtractedDocument } from "@/lib/ai/extractor"
import { formatMoney } from "@/lib/money"
import {
  MAX_ATTACHMENT_BYTES,
  tooLargeMessage,
} from "@/lib/upload/limits"
import { uploadAttachment } from "@/app/actions/expenses"
import { useUpgrade } from "@/components/billing/upgrade-dialog"
import {
  extractFromUpload,
  confirmExpenseFromCapture,
} from "@/app/actions/ai-capture"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Parsed = {
  extractionId: string | null
  parsed: ExtractedDocument
  matchedContactId: string | null
  attachmentPath: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return d && m && y ? `${d}.${m}.${y}` : iso
}

function confidenceVariant(c: number): "default" | "secondary" | "destructive" {
  if (c >= 0.75) return "default"
  if (c >= 0.5) return "secondary"
  return "destructive"
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm font-medium tabular-nums">
        {value}
      </span>
    </div>
  )
}

export function AiCaptureDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [extracting, startExtract] = useTransition()
  const [confirming, startConfirm] = useTransition()
  const { prompt } = useUpgrade()
  const [degraded, setDegraded] = useState<string | null>(null)
  const [result, setResult] = useState<Parsed | null>(null)

  function reset() {
    setResult(null)
    setDegraded(null)
  }

  function handleClose(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Cisti sa HNED — inak po zlyhani neslo znova vybrat ten isty subor,
    // co je pri fotke bloceka bezny pripad.
    e.target.value = ""
    if (!file) return
    reset()

    // Fotka z mobilu ma bezne 2-5 MB. Bez tejto kontroly by skoncila na
    // HTTP 413 bez hlasky.
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(tooLargeMessage(file.size, MAX_ATTACHMENT_BYTES))
      return
    }

    startExtract(async () => {
      const fd = new FormData()
      fd.set("file", file)

      // Store the file (best-effort) and extract in parallel.
      let upload: Awaited<ReturnType<typeof uploadAttachment>>
      let extraction: Awaited<ReturnType<typeof extractFromUpload>>
      try {
        ;[upload, extraction] = await Promise.all([
          uploadAttachment(fd),
          extractFromUpload(fd),
        ])
      } catch {
        toast.error("Súbor sa nepodarilo spracovať. Skús to znova.")
        return
      }

      if (!extraction.ok) {
        // Paywall má ponúknuť upgrade, nie tvrdiť, že chýba kľúč.
        if (extraction.upgrade) {
          prompt(extraction.upgrade, extraction.error)
        } else if (extraction.reason === "no_key") {
          setDegraded(
            "AI vyťaženie nie je nakonfigurované (chýba kľúč). Zadaj náklad ručne.",
          )
        } else {
          toast.error(extraction.error)
        }
        return
      }

      setResult({
        extractionId: extraction.extractionId,
        parsed: extraction.parsed,
        matchedContactId: extraction.matchedContactId,
        attachmentPath: upload.ok ? upload.path : null,
      })
    })
  }

  function handleConfirm() {
    if (!result) return
    startConfirm(async () => {
      const res = await confirmExpenseFromCapture({
        extractionId: result.extractionId,
        parsed: result.parsed,
        supplierContactId: result.matchedContactId,
        attachmentPath: result.attachmentPath,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Náklad vytvorený z dokladu.")
      handleClose(false)
      router.refresh()
    })
  }

  const p = result?.parsed
  const currency = p?.currency ?? "EUR"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Vyťažiť doklad (AI)
          </DialogTitle>
          <DialogDescription>
            Nahraj faktúru alebo bloček (PDF alebo foto). AI vyplní polia, ty
            len potvrdíš.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFile}
            disabled={extracting || confirming}
          />

          {extracting && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Vyťažujem údaje z dokladu…
            </div>
          )}

          {degraded && (
            <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
              {degraded}
            </div>
          )}

          {p && !extracting && (
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Vyťažené údaje</span>
                <Badge variant={confidenceVariant(p.confidence)}>
                  Spoľahlivosť {Math.round(p.confidence * 100)} %
                </Badge>
              </div>

              <div className="bg-muted/40 rounded-lg border p-3">
                <Row label="Dodávateľ" value={p.supplierName ?? "—"} />
                <Row label="IČO" value={p.supplierIco ?? "—"} />
                <Row
                  label="Priradený kontakt"
                  value={
                    result?.matchedContactId ? (
                      <Badge variant="secondary">spárovaný</Badge>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row label="Číslo dokladu" value={p.documentNumber ?? "—"} />
                <Row label="Vystavené" value={fmtDate(p.issueDate)} />
                <Row label="Splatnosť" value={fmtDate(p.dueDate)} />
                <Row
                  label="Základ"
                  value={
                    p.subtotal != null ? formatMoney(p.subtotal, currency) : "—"
                  }
                />
                <Row
                  label="DPH"
                  value={
                    p.vatTotal != null ? formatMoney(p.vatTotal, currency) : "—"
                  }
                />
                <Row
                  label="Spolu"
                  value={p.total != null ? formatMoney(p.total, currency) : "—"}
                />
              </div>

              {result?.attachmentPath && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Paperclip className="size-3" /> doklad uložený ako príloha
                </span>
              )}

              <p className="text-muted-foreground text-xs">
                Skontroluj údaje. Náklad sa vytvorí ako koncept až po potvrdení.
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleClose(false)}
                  disabled={confirming}
                >
                  Zrušiť
                </Button>
                <Button onClick={handleConfirm} disabled={confirming}>
                  {confirming && <Loader2 className="size-4 animate-spin" />}
                  Potvrdiť náklad
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
