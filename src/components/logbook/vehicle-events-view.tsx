"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Wrench } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import {
  VEHICLE_EVENT_TYPE_LABELS,
  type VehicleEventType,
} from "@/lib/validation/vehicle-event"
import { deleteVehicleEvent } from "@/app/actions/vehicle-events"
import { VehicleEventForm } from "./vehicle-event-form"
import type { ExpenseOption } from "./refueling-form"
import { formatKm, fmtDate } from "./trips-view"

import { Badge } from "@/components/ui/badge"
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

type VehicleEvent = Database["public"]["Tables"]["vehicle_events"]["Row"]

const DAY_MS = 86_400_000
/** Odkedy pred terminom to uz je "coskoro" — STK aj poistka sa daju vybavit. */
const SOON_DAYS = 30

type DueState = "none" | "overdue" | "soon" | "future"

/**
 * Stav pripomienky dalsieho terminu. Datumy porovnavame ako ISO retazce a
 * rozdiel ratame v UTC — inak by sa vysledok menil podla casovej zony.
 */
function dueState(iso: string | null): DueState {
  if (!iso) return "none"
  const today = new Date().toISOString().slice(0, 10)
  if (iso < today) return "overdue"
  const days = Math.round((Date.parse(iso) - Date.parse(today)) / DAY_MS)
  return days <= SOON_DAYS ? "soon" : "future"
}

export function VehicleEventsView({
  vehicleId,
  events,
  expenses,
}: {
  vehicleId: string
  events: VehicleEvent[]
  expenses: ExpenseOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleEvent | null>(null)
  const [deleting, setDeleting] = useState<VehicleEvent | null>(null)
  const [pending, startTransition] = useTransition()

  const totalCost = events.reduce((sum, e) => sum + (e.cost ?? 0), 0)
  const overdue = events.filter((e) => dueState(e.next_due_on) === "overdue")
  const soon = events.filter((e) => dueState(e.next_due_on) === "soon")

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
      const res = await deleteVehicleEvent(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Udalosť zmazaná.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Udalosti</h2>
          <p className="text-muted-foreground text-sm">
            Servis, STK, poistka, opravy — spolu {formatMoney(totalCost)}.
            {overdue.length > 0
              ? ` Po termíne: ${overdue.length}.`
              : soon.length > 0
                ? ` Do ${SOON_DAYS} dní: ${soon.length}.`
                : ""}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nová udalosť
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-12 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Wrench className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ žiadne udalosti</p>
            <p className="text-muted-foreground text-sm">
              Zapíš servis, STK alebo poistku — a k nej ďalší termín.
            </p>
          </div>
          <Button onClick={openNew} variant="outline">
            <Plus className="size-4" />
            Nová udalosť
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Dátum</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead className="text-right">Náklad</TableHead>
                <TableHead className="text-right">Tachometer</TableHead>
                <TableHead>Doklad</TableHead>
                <TableHead>Ďalší termín</TableHead>
                <TableHead className="w-24 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const due = dueState(e.next_due_on)
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {VEHICLE_EVENT_TYPE_LABELS[e.type as VehicleEventType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(e.event_date)}
                    </TableCell>
                    <TableCell>{e.description || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.cost === null ? "—" : formatMoney(e.cost)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {formatKm(e.odometer_km)}
                    </TableCell>
                    <TableCell>{expenseLabel(e.expense_id)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {due === "none" ? (
                        "—"
                      ) : (
                        <span className="flex items-center gap-2">
                          {fmtDate(e.next_due_on)}
                          {due === "overdue" ? (
                            <Badge variant="destructive">po termíne</Badge>
                          ) : due === "soon" ? (
                            <Badge variant="outline">čoskoro</Badge>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(e)
                          setOpen(true)
                        }}
                        title="Upraviť"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(e)}
                        title="Zmazať"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť udalosť" : "Nová udalosť"}
            </DialogTitle>
            <DialogDescription>
              Ďalší termín slúži ako pripomienka — napr. dátum ďalšej STK.
            </DialogDescription>
          </DialogHeader>
          <VehicleEventForm
            vehicleId={vehicleId}
            event={editing}
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
            <AlertDialogTitle>Zmazať udalosť?</AlertDialogTitle>
            <AlertDialogDescription>
              Záznam z {fmtDate(deleting?.event_date ?? null)} bude natrvalo
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
