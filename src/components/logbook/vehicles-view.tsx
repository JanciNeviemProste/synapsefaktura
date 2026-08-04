"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Car } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  FUEL_TYPE_LABELS,
  VEHICLE_OWNERSHIP_LABELS,
  type FuelType,
  type VehicleOwnership,
} from "@/lib/validation/vehicle"
import { deleteVehicle } from "@/app/actions/vehicles"
import { VehicleForm } from "./vehicle-form"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"]

/** Najazdene km a pocet jaziek na vozidlo — stlpec "Cesty km/ks" v SuperCestaku. */
export type VehicleTripStats = Record<string, { km: number; trips: number }>

const kmFormat = new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 1 })

/** Km bez desatinnej nuly navyse: 12 500 km, nie 12 500,0 km. */
export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—"
  return `${kmFormat.format(value)} km`
}

/**
 * Spotreba sa zobrazuje ako "—", ked nie je vyplnena. Nula by tvrdila, ze
 * vozidlo nespotrebuje nic, a teda ze uznatelne nie je ziadne palivo.
 */
function formatConsumption(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${kmFormat.format(value)} l/100 km`
}

export function VehiclesView({
  vehicles,
  tripStats = {},
  detailBasePath,
}: {
  vehicles: Vehicle[]
  tripStats?: VehicleTripStats
  /**
   * Zaklad cesty na detail vozidla, napr. "/app/logbook/vehicles". Ked chyba,
   * nazov zostane obycajnym textom — mrtvy odkaz je horsi nez ziadny. Modul
   * jaziek si ho doplni, ked bude detail existovat.
   */
  detailBasePath?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const [pending, startTransition] = useTransition()

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
      const res = await deleteVehicle(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Vozidlo zmazané.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kniha jázd</h1>
          <p className="text-muted-foreground text-sm">
            Vozidlá, ich spotreba a stav tachometra. Kniha jázd je daňový
            podklad.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nové vozidlo
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Car className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Zatiaľ žiadne vozidlá</p>
            <p className="text-muted-foreground text-sm">
              Pridaj vozidlo a môžeš na neho zapisovať jazdy aj tankovanie.
            </p>
          </div>
          <Button onClick={openNew} variant="outline">
            <Plus className="size-4" />
            Nové vozidlo
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov / popis</TableHead>
                <TableHead>ECV</TableHead>
                <TableHead>Palivo</TableHead>
                <TableHead className="text-right">Spotreba</TableHead>
                <TableHead>Vlastník</TableHead>
                <TableHead className="text-right">Aktuálny stav</TableHead>
                <TableHead className="text-right">Najazdené km</TableHead>
                <TableHead className="w-24 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => {
                const stats = tripStats[v.id]
                const fuelLabel = FUEL_TYPE_LABELS[v.fuel_type as FuelType]
                const ownershipLabel =
                  VEHICLE_OWNERSHIP_LABELS[v.ownership as VehicleOwnership]
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      {detailBasePath ? (
                        <Link
                          href={`${detailBasePath}/${v.id}`}
                          className="hover:underline"
                        >
                          {v.name}
                        </Link>
                      ) : (
                        v.name
                      )}
                      {!v.active && (
                        <Badge variant="secondary" className="ml-2">
                          mimo prevádzky
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.license_plate}
                    </TableCell>
                    <TableCell>{fuelLabel}</TableCell>
                    <TableCell className="text-right">
                      {formatConsumption(v.consumption_l_100km)}
                    </TableCell>
                    <TableCell>{ownershipLabel}</TableCell>
                    <TableCell className="text-right">
                      {formatKm(v.odometer_km)}
                    </TableCell>
                    <TableCell className="text-right">
                      {stats ? (
                        <span title={`${stats.trips} jázd`}>
                          {formatKm(stats.km)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(v)
                          setOpen(true)
                        }}
                        title="Upraviť"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(v)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť vozidlo" : "Nové vozidlo"}
            </DialogTitle>
            <DialogDescription>
              Údaje vozidla pre knihu jázd a výpočet uznateľného paliva.
            </DialogDescription>
          </DialogHeader>
          <VehicleForm vehicle={editing} onDone={handleDone} />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať vozidlo?</AlertDialogTitle>
            <AlertDialogDescription>
              Vozidlo „{deleting?.name}" sa zmaže aj so všetkými jazdami,
              tankovaniami a udalosťami. Kniha jázd je daňový podklad — tento
              krok sa nedá vrátiť.
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
