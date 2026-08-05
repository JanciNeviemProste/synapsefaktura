"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Lock, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import {
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_LABELS,
  type VehicleCategory,
} from "@/lib/validation/vehicle"
import {
  createTravelRate,
  updateTravelRate,
  deleteTravelRate,
  confirmStatutoryRate,
} from "@/app/actions/travel-rates"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type TravelRate = Database["public"]["Tables"]["travel_rates"]["Row"]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TravelRatesSettings({
  rates,
  pending = null,
}: {
  rates: TravelRate[]
  /** Zakonna sadzba, ktoru nasiel cron a nikto ju este nepotvrdil. */
  pending?: TravelRate | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TravelRate | null>(null)
  const [deleting, setDeleting] = useState<TravelRate | null>(null)
  const [busy, startTransition] = useTransition()

  // Styri polia — react-hook-form by tu bol tazsi nez samotny formular.
  const [validFrom, setValidFrom] = useState(today())
  const [validTo, setValidTo] = useState("")
  const [ratePerKm, setRatePerKm] = useState("")
  const [note, setNote] = useState("")
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory | "">("")

  function openNew() {
    setEditing(null)
    setValidFrom(today())
    setValidTo("")
    setRatePerKm("")
    setNote("")
    setVehicleCategory("")
    setOpen(true)
  }

  function openEdit(r: TravelRate) {
    setEditing(r)
    setValidFrom(r.valid_from)
    setValidTo(r.valid_to ?? "")
    setRatePerKm(String(r.rate_per_km))
    setNote(r.note ?? "")
    setVehicleCategory((r.vehicle_category as VehicleCategory) ?? "")
    setOpen(true)
  }

  function submit() {
    startTransition(async () => {
      const values = {
        validFrom,
        validTo,
        // Prazdne pole nesmie prejst ako 0 — to by bola platna sadzba nula.
        ratePerKm: ratePerKm.trim() === "" ? Number.NaN : Number(ratePerKm),
        currency: editing?.currency ?? "EUR",
        vehicleCategory: vehicleCategory === "" ? null : vehicleCategory,
        note,
      }
      const res = editing
        ? await updateTravelRate(editing.id, values)
        : await createTravelRate(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editing ? "Sadzba upravená." : "Sadzba pridaná.")
      setOpen(false)
      setEditing(null)
      router.refresh()
    })
  }

  function confirmPending() {
    if (!pending) return
    startTransition(async () => {
      const res = await confirmStatutoryRate(pending.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Nová zákonná sadzba potvrdená.")
        router.refresh()
      }
    })
  }

  function confirmDelete() {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteTravelRate(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Sadzba zmazaná.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="grid gap-1">
          <CardTitle>Cestovné náhrady</CardTitle>
          <CardDescription>
            Sadzba za služobný kilometer. Jazda sa počíta sadzbou platnou
            v čase jazdy, preto má každá platnosť od-do. Vlastná sadzba firmy
            má prednosť pred zákonnou.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="size-4" />
          Pridať
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Novu zakonnu sadzbu nasiel cron na stranke ministerstva. Do
            potvrdenia sa NEPOUZIVA — dañove cislo sa nema zmenit samo. */}
        {pending ? (
          <div className="border-l-amber-500 bg-muted/30 grid gap-2 rounded-md border-l-2 p-3">
            <div className="flex items-start gap-2">
              <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
              <div className="grid gap-1 text-sm">
                <p className="font-medium">Zistená nová zákonná sadzba</p>
                <p className="text-muted-foreground">
                  {formatMoney(pending.rate_per_km, pending.currency)}/km pre
                  osobné auto s účinnosťou od {pending.valid_from}
                  {pending.source_ref ? ` — ${pending.source_ref}` : ""}. Kým ju
                  nepotvrdíš, náhrada sa počíta pôvodnou sadzbou.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={confirmPending} disabled={busy}>
                Potvrdiť
              </Button>
              {pending.source_url ? (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={pending.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Zobraziť zdroj
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {rates.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Zatiaľ žiadna sadzba. Bez nej sa náhrada za km nepočíta — zámerne,
            je to zákonné číslo a nechceme ho hádať za teba.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platnosť</TableHead>
                <TableHead>Vozidlo</TableHead>
                <TableHead className="text-right">Sadzba za km</TableHead>
                <TableHead>Zdroj</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead className="w-20 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => {
                const statutory = r.organization_id === null
                return (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">
                      {r.valid_from} – {r.valid_to ?? "doteraz"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.vehicle_category
                        ? VEHICLE_CATEGORY_LABELS[
                            r.vehicle_category as VehicleCategory
                          ]
                        : "Všetky"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.rate_per_km, r.currency)}
                    </TableCell>
                    <TableCell>
                      {statutory ? (
                        <Badge variant="outline">
                          <Lock className="size-3" />
                          Zákonná
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Vlastná</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Zakonnu sadzbu meni len migracia — tlacidla by
                          slubovali akciu, ktoru RLS aj tak odmietne. */}
                      {statutory ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(r)}
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
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť sadzbu" : "Nová sadzba"}
            </DialogTitle>
            <DialogDescription>
              Koniec platnosti nechaj prázdny, ak sadzba platí doteraz.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rate-from">Platná od</Label>
                <Input
                  id="rate-from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rate-to">Platná do</Label>
                <Input
                  id="rate-to"
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Platí pre</Label>
              <Select
                value={vehicleCategory === "" ? "all" : vehicleCategory}
                onValueChange={(v) =>
                  setVehicleCategory(v === "all" ? "" : (v as VehicleCategory))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky vozidlá</SelectItem>
                  {VEHICLE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {VEHICLE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Zákon má pre motocykel výrazne nižšiu sadzbu než pre osobné
                auto. Ak si dohodnutú sadzbu neodlišuješ, nechaj „Všetky".
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rate-per-km">Sadzba za km (EUR)</Label>
              <Input
                id="rate-per-km"
                type="number"
                step="0.0001"
                min={0}
                value={ratePerKm}
                onChange={(e) => setRatePerKm(e.target.value)}
                placeholder="0.2700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate-note">Poznámka</Label>
              <Input
                id="rate-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="napr. odkaz na opatrenie, ktorým sa sadzba mení"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={submit} disabled={busy}>
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať sadzbu?</AlertDialogTitle>
            <AlertDialogDescription>
              Jazdy z obdobia, ktoré táto sadzba pokrývala, sa po zmazaní budú
              počítať inou sadzbou — alebo žiadnou. Doklady sa nemenia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy}>
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
