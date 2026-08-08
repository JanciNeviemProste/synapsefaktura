"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Paperclip } from "lucide-react"
import { toast } from "sonner"

import type { ExtractedDocument } from "@/lib/ai/extractor"
import {
  applyEdit,
  fieldToInput,
  totalsMismatch,
  type EditableField,
} from "@/lib/expenses/capture-edit"
import { MAX_ATTACHMENT_BYTES, tooLargeMessage } from "@/lib/upload/limits"
import { uploadDirect } from "@/lib/upload/direct"
import { useUpgrade } from "@/components/billing/upgrade-dialog"
import {
  extractFromStoredFile,
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

function confidenceVariant(c: number): "default" | "secondary" | "destructive" {
  if (c >= 0.75) return "default"
  if (c >= 0.5) return "secondary"
  return "destructive"
}

/**
 * Vyťažené pole, ktoré sa dá prepísať.
 *
 * Predtým to boli len vypísané hodnoty. Pri jednej zle prečítanej číslici tak
 * ostávalo na výber prijať nesprávny doklad, alebo zahodiť aj to, čo AI
 * prečítala správne.
 */
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  type?: "text" | "date"
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label className="grid grid-cols-[9rem_1fr] items-center gap-3 py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
    </label>
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
      // Subor ide PRIAMO do uloziska a odtial si ho vyzdvihne vytazenie.
      // Doteraz cestoval po drote dvakrat (raz na ulozenie, raz na vytazenie)
      // — pri fotke z mobilu na datach to bol dvojnasobny upload. A cez
      // server action by sa vacsia fotka aj tak nedostala (Vercel: 4,5 MB).
      let upload: Awaited<ReturnType<typeof uploadDirect>>
      let extraction: Awaited<ReturnType<typeof extractFromStoredFile>>
      try {
        upload = await uploadDirect("attachment", file)
        if (!upload.ok) {
          toast.error(upload.error)
          return
        }
        extraction = await extractFromStoredFile(upload.path)
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
        attachmentPath: upload.path,
      })
    })
  }

  /** Prepísanie vyťaženého poľa. Uloží sa až pri potvrdení, ako doteraz. */
  function edit(field: EditableField, input: string) {
    setResult((prev) =>
      prev ? { ...prev, parsed: applyEdit(prev.parsed, field, input) } : prev,
    )
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
  // Upozornenie, nie zámok: ručná oprava jednej sumy je najčastejší spôsob,
  // ako sa doklad rozsype, ale bloček s vlastným zaokrúhlením existuje tiež.
  const mismatch = p ? totalsMismatch(p) : null

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

              <div className="bg-muted/40 grid gap-1 rounded-lg border p-3">
                <Field
                  label="Dodávateľ"
                  value={fieldToInput(p, "supplierName")}
                  onChange={(v) => edit("supplierName", v)}
                  disabled={confirming}
                />
                <Field
                  label="IČO"
                  value={fieldToInput(p, "supplierIco")}
                  onChange={(v) => edit("supplierIco", v)}
                  disabled={confirming}
                />
                <Field
                  label="Číslo dokladu"
                  value={fieldToInput(p, "documentNumber")}
                  onChange={(v) => edit("documentNumber", v)}
                  disabled={confirming}
                />
                <Field
                  label="Vystavené"
                  type="date"
                  value={fieldToInput(p, "issueDate")}
                  onChange={(v) => edit("issueDate", v)}
                  disabled={confirming}
                />
                <Field
                  label="Splatnosť"
                  type="date"
                  value={fieldToInput(p, "dueDate")}
                  onChange={(v) => edit("dueDate", v)}
                  disabled={confirming}
                />
                <Field
                  label={`Základ (${currency})`}
                  value={fieldToInput(p, "subtotal")}
                  onChange={(v) => edit("subtotal", v)}
                  placeholder="0,00"
                  disabled={confirming}
                />
                <Field
                  label={`DPH (${currency})`}
                  value={fieldToInput(p, "vatTotal")}
                  onChange={(v) => edit("vatTotal", v)}
                  placeholder="0,00"
                  disabled={confirming}
                />
                <Field
                  label={`Spolu (${currency})`}
                  value={fieldToInput(p, "total")}
                  onChange={(v) => edit("total", v)}
                  placeholder="0,00"
                  disabled={confirming}
                />

                <div className="text-muted-foreground flex items-center gap-2 pt-1 text-xs">
                  Priradený kontakt:
                  {result?.matchedContactId ? (
                    <Badge variant="secondary">spárovaný podľa IČO</Badge>
                  ) : (
                    <span>nový dodávateľ</span>
                  )}
                </div>
              </div>

              {mismatch && (
                <p className="text-destructive text-xs">{mismatch}</p>
              )}

              {result?.attachmentPath && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Paperclip className="size-3" /> doklad uložený ako príloha
                </span>
              )}

              <p className="text-muted-foreground text-xs">
                Údaje sa dajú prepísať. Náklad sa vytvorí ako koncept až po
                potvrdení.
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
