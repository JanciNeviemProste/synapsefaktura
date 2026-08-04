"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Fuel } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import { deleteRefueling } from "@/app/actions/refuelings"
import { RefuelingForm, type ExpenseOption } from "./refueling-form"
import { formatKm, fmtDate } from "./trips-view"

import { Button } from "@/components/ui/button"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Refueling = Database["public"]["Tables"]["refuelings"]["Row"]

function formatLitres(value: number): string {
  return `${new Intl.NumberFormat("sk-SK", {
    maximumFractionDigits: 2,
  }).format(value)} l`
}

export function RefuelingsView({
  vehicleId,
  refuelings,
  expenses,
}: {
  vehicleId: string
  refuelings: Refueling[]
  expenses: ExpenseOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Refueling | null>(null)
  const [deleting, setDeleting] = useState<Refueling | null>(null)
  const [pending, startTransition] = useTransition()

  const totalLitres = refuelings.reduce((sum, r) => sum + r.litres, 0)
  const totalPrice = refuelings.reduce((sum, r) => sum + r.total_price, 0)

  const expenseLabel = (id: string | null) => {
    if (!id) return "—"
    const e = expenses.find((x) => x.id === id)
    return e ? (e.document_number ?? "Bez čísla") : "—"
  }

  function openNew() {
    setEditing(null)
    setOpen(true)
  }
  function handleDone() {
    setOpen(false)
    setEditing(null)
    router.refresh()
  }
  function confirmDelete() {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteRefueling(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Tankovanie zmazané.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tankovanie</h2>
          <p className="text-muted-foreground text-sm">
            Spolu {formatLitres(totalLitres)} za {formatMoney(totalPrice)} —
            druhá strana porovnania pri daňovej kontrole.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nové tankovanie
        </Button>
      </div>

      {refuelings.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-12 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Fuel className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ žiadne tankovanie</p>
            <p className="text-muted-foreground text-sm">
              Bez dokladov o nákupe paliva sa uznateľné palivo nedá doložiť.
            </p>
          </div>
          <Button onClick={openNew} variant="outline">
            <Plus className="size-4" />
            Nové tankovanie
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead className="text-right">Litre</TableHead>
                <TableHead className="text-right">Cena / l</TableHead>
                <TableHead className="text-right">Suma</TableHead>
                <TableHead className="text-right">Tachometer</TableHead>
                <TableHead>Náklad</TableHead>
                <TableHead className="w-24 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refuelings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {fmtDate(r.refueled_at)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLitres(r.litres)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(r.price_per_litre)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(r.total_price)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatKm(r.odometer_km)}
                  </TableCell>
                  <TableCell>{expenseLabel(r.expense_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(r)
                        setOpen(true)
                      }}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(r)}
                      title="Zmazať"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť tankovanie" : "Nové tankovanie"}
            </DialogTitle>
            <DialogDescription>
              Doklad o nákupe paliva. Celková suma sa dopočíta z litrov a ceny.
            </DialogDescription>
          </DialogHeader>
          <RefuelingForm
            vehicleId={vehicleId}
            refueling={editing}
            expenses={expenses}
            onDone={handleDone}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať tankovanie?</AlertDialogTitle>
            <AlertDialogDescription>
              Záznam z {fmtDate(deleting?.refueled_at ?? null)} bude natrvalo
              odstránený.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={pending}>
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
