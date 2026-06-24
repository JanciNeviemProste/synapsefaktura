"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import { upsertSequence } from "@/app/actions/sequences"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Sequence = Database["public"]["Tables"]["number_sequences"]["Row"]

const CURRENT_YEAR = 2026

export function SequencesSettings({ sequences }: { sequences: Sequence[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Sequence | null>(null)
  const [pending, startTransition] = useTransition()

  // Controlled form state (small enough to skip react-hook-form here).
  const [docType, setDocType] = useState<DocumentType>("invoice")
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [prefix, setPrefix] = useState("")
  const [format, setFormat] = useState("{year}{seq}")
  const [padding, setPadding] = useState("4")
  const [nextNumber, setNextNumber] = useState("1")

  function openNew() {
    setEditing(null)
    setDocType("invoice")
    setYear(String(CURRENT_YEAR))
    setPrefix("")
    setFormat("{year}{seq}")
    setPadding("4")
    setNextNumber("1")
    setOpen(true)
  }

  function openEdit(s: Sequence) {
    setEditing(s)
    setDocType(s.doc_type as DocumentType)
    setYear(String(s.year))
    setPrefix(s.prefix)
    setFormat(s.format)
    setPadding(String(s.padding))
    setNextNumber(String(s.next_number))
    setOpen(true)
  }

  function preview() {
    const seq = nextNumber.padStart(Number(padding) || 1, "0")
    return format
      .replace("{prefix}", prefix)
      .replace("{year}", year)
      .replace("{seq}", seq)
  }

  function save() {
    startTransition(async () => {
      const res = await upsertSequence({
        docType,
        year: Number(year),
        prefix,
        format,
        padding: Number(padding),
        nextNumber: Number(nextNumber),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Číselný rad uložený.")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="grid gap-1">
          <CardTitle>Číselné rady</CardTitle>
          <CardDescription>
            Formát čísel dokladov. Tokeny: {"{prefix}"} {"{year}"} {"{seq}"}.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="size-4" />
          Pridať
        </Button>
      </CardHeader>
      <CardContent>
        {sequences.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Zatiaľ žiadne číselné rady. Vytvoria sa automaticky pri prvom
            vystavení, alebo ich nastav vopred.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ dokladu</TableHead>
                <TableHead>Rok</TableHead>
                <TableHead>Formát</TableHead>
                <TableHead>Ďalšie číslo</TableHead>
                <TableHead className="w-16 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {DOCUMENT_TYPE_LABELS[s.doc_type as DocumentType] ??
                      s.doc_type}
                  </TableCell>
                  <TableCell>{s.year}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.format}
                  </TableCell>
                  <TableCell>{s.next_number}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(s)}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť číselný rad" : "Nový číselný rad"}
            </DialogTitle>
            <DialogDescription>
              Náhľad ďalšieho čísla:{" "}
              <span className="font-mono font-medium">{preview()}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Typ dokladu</Label>
                <Select
                  value={docType}
                  onValueChange={(v) => setDocType(v as DocumentType)}
                  disabled={!!editing}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: DocumentType) => DOCUMENT_TYPE_LABELS[v]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Rok</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={!!editing}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prefix</Label>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="napr. FA"
                />
              </div>
              <div className="grid gap-2">
                <Label>Formát</Label>
                <Input
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Počet číslic</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={padding}
                  onChange={(e) => setPadding(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Ďalšie číslo</Label>
                <Input
                  type="number"
                  min={1}
                  value={nextNumber}
                  onChange={(e) => setNextNumber(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={save} disabled={pending}>
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
