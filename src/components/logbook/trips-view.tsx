"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Route } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { TRIP_PURPOSE_LABELS, type TripPurpose } from "@/lib/validation/trip"
import { deleteTrip } from "@/app/actions/trips"
import { TripForm, type ContactOption } from "./trip-form"

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

type Trip = Database["public"]["Tables"]["trips"]["Row"]

export function formatKm(value: number | null): string {
  if (value === null) return "—"
  return `${new Intl.NumberFormat("sk-SK", {
    maximumFractionDigits: 1,
  }).format(value)} km`
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export function TripsView({
  vehicleId,
  trips,
  contacts,
}: {
  vehicleId: string
  trips: Trip[]
  contacts: ContactOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [deleting, setDeleting] = useState<Trip | null>(null)
  const [pending, startTransition] = useTransition()

  const contactName = (id: string | null) =>
    id ? (contacts.find((c) => c.id === id)?.name ?? "—") : "—"

  // Sluzobne a sukromne km drzime osobitne: do danovo uznatelnych nakladov
  // vstupuju IBA sluzobne.
  const businessKm = trips
    .filter((t) => t.purpose === "business")
    .reduce((sum, t) => sum + t.distance_km, 0)
  const privateKm = trips
    .filter((t) => t.purpose === "private")
    .reduce((sum, t) => sum + t.distance_km, 0)

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
      const res = await deleteTrip(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Jazda zmazaná.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Jazdy</h2>
          <p className="text-muted-foreground text-sm">
            Služobné {formatKm(businessKm)} — daňovo uznateľné · súkromné{" "}
            {formatKm(privateKm)} — <strong>neuznateľné</strong>.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nová jazda
        </Button>
      </div>

      {trips.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-12 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Route className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ žiadne jazdy</p>
            <p className="text-muted-foreground text-sm">
              Kniha jázd je daňový podklad — zapíš prvú jazdu.
            </p>
          </div>
          <Button onClick={openNew} variant="outline">
            <Plus className="size-4" />
            Nová jazda
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Trasa</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Účel</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Dĺžka</TableHead>
                <TableHead className="text-right">Tachometer</TableHead>
                <TableHead className="w-24 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">
                    {fmtDate(t.trip_date)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {t.origin || "—"} {t.round_trip ? "↔" : "→"}{" "}
                      {t.destination || "—"}
                    </span>
                    {t.driver_name ? (
                      <span className="text-muted-foreground block text-xs">
                        Vodič: {t.driver_name}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{contactName(t.contact_id)}</TableCell>
                  <TableCell>{t.purpose_note || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.purpose === "private" ? "destructive" : "secondary"
                      }
                      title={
                        t.purpose === "private"
                          ? "Súkromná jazda — nezapočítava sa do daňovo uznateľných nákladov."
                          : "Služobná jazda — daňovo uznateľná."
                      }
                    >
                      {TRIP_PURPOSE_LABELS[t.purpose as TripPurpose]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKm(t.distance_km)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                    {t.odometer_start_km === null && t.odometer_end_km === null
                      ? "—"
                      : `${formatKm(t.odometer_start_km)} → ${formatKm(
                          t.odometer_end_km,
                        )}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(t)
                        setOpen(true)
                      }}
                      title="Upraviť"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(t)}
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
              {editing ? "Upraviť jazdu" : "Nová jazda"}
            </DialogTitle>
            <DialogDescription>
              Súkromné jazdy sa do daňovo uznateľných nákladov nezapočítavajú.
            </DialogDescription>
          </DialogHeader>
          <TripForm
            vehicleId={vehicleId}
            trip={editing}
            contacts={contacts}
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
            <AlertDialogTitle>Zmazať jazdu?</AlertDialogTitle>
            <AlertDialogDescription>
              Jazda z {fmtDate(deleting?.trip_date ?? null)} bude natrvalo
              odstránená. Kniha jázd je daňový podklad — maž len omyly.
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
