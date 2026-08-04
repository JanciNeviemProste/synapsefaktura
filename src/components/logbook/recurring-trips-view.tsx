"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, CalendarClock, Play } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { TRIP_PURPOSE_LABELS, type TripPurpose } from "@/lib/validation/trip"
import {
  TRIP_CADENCE_LABELS,
  type RecurringTripInput,
} from "@/lib/validation/recurring-trip"
import {
  createRecurringTrip,
  updateRecurringTrip,
  deleteRecurringTrip,
  generateDueTrips,
} from "@/app/actions/recurring-trips"
import type { ContactOption } from "./trip-form"
import { formatKm, fmtDate } from "./trips-view"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

type RecurringTrip = Database["public"]["Tables"]["recurring_trips"]["Row"]
type Cadence = keyof typeof TRIP_CADENCE_LABELS

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Šablóny pravidelných jázd — dochádzka, rozvoz, týždenná návšteva klienta.
 *
 * Generovanie spúšťa používateľ tlačidlom, NIE cron. Kniha jázd je daňový
 * podklad a zápis jazdy, ktorá sa možno neuskutočnila, musí byť vedomý úkon.
 */
export function RecurringTripsView({
  vehicleId,
  recurringTrips,
  contacts,
}: {
  vehicleId: string
  recurringTrips: RecurringTrip[]
  contacts: ContactOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTrip | null>(null)
  const [deleting, setDeleting] = useState<RecurringTrip | null>(null)
  const [pending, startTransition] = useTransition()

  const [cadence, setCadence] = useState<Cadence>("monthly")
  const [intervalDays, setIntervalDays] = useState("")
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")
  const [contactId, setContactId] = useState("")
  const [distanceKm, setDistanceKm] = useState("")
  const [roundTrip, setRoundTrip] = useState(true)
  const [purpose, setPurpose] = useState<TripPurpose>("business")
  const [purposeNote, setPurposeNote] = useState("")
  const [nextRunOn, setNextRunOn] = useState(today())
  const [active, setActive] = useState(true)

  function openNew() {
    setEditing(null)
    setCadence("monthly")
    setIntervalDays("")
    setOrigin("")
    setDestination("")
    setContactId("")
    setDistanceKm("")
    setRoundTrip(true)
    setPurpose("business")
    setPurposeNote("")
    setNextRunOn(today())
    setActive(true)
    setOpen(true)
  }

  function openEdit(r: RecurringTrip) {
    setEditing(r)
    setCadence(r.cadence as Cadence)
    setIntervalDays("")
    setOrigin(r.origin ?? "")
    setDestination(r.destination ?? "")
    setContactId(r.contact_id ?? "")
    setDistanceKm(String(r.distance_km))
    setRoundTrip(r.round_trip)
    setPurpose(r.purpose as TripPurpose)
    setPurposeNote(r.purpose_note ?? "")
    setNextRunOn(r.next_run_on ?? today())
    setActive(r.active)
    setOpen(true)
  }

  function submit() {
    startTransition(async () => {
      const values: RecurringTripInput = {
        vehicleId,
        cadence,
        intervalDays:
          cadence === "custom" && intervalDays.trim() !== ""
            ? Number(intervalDays)
            : undefined,
        origin,
        destination,
        contactId,
        // Prazdne pole nesmie prejst ako 0 — to by bola platna nulova jazda.
        distanceKm: distanceKm.trim() === "" ? Number.NaN : Number(distanceKm),
        roundTrip,
        purpose,
        purposeNote,
        nextRunOn,
        active,
      }
      const res = editing
        ? await updateRecurringTrip(editing.id, values)
        : await createRecurringTrip(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        editing ? "Pravidelná jazda upravená." : "Pravidelná jazda pridaná.",
      )
      setOpen(false)
      setEditing(null)
      router.refresh()
    })
  }

  function confirmDelete() {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteRecurringTrip(deleting.id)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Pravidelná jazda zmazaná.")
        router.refresh()
      }
      setDeleting(null)
    })
  }

  function generate() {
    startTransition(async () => {
      const res = await generateDueTrips(vehicleId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.generated === 0) {
        toast.info("Žiadne splatné termíny — jazdy sú zapísané.")
        return
      }
      toast.success(
        `Zapísaných ${res.generated} ${
          res.generated === 1 ? "jazda" : res.generated < 5 ? "jazdy" : "jázd"
        }.` +
          (res.capped
            ? " Časť zameškaných termínov zostala — spusti generovanie znova."
            : ""),
      )
      router.refresh()
    })
  }

  const dueCount = recurringTrips.filter(
    (r) => r.active && r.next_run_on !== null && r.next_run_on <= today(),
  ).length

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" />
          Pravidelné jazdy
        </CardTitle>
        <CardDescription>
          Šablóna, z ktorej sa jazdy zapisujú do knihy. Generovanie spúšťaš ty —
          kniha jázd je daňový podklad, takže sa nič nezapíše samo.
          {dueCount > 0
            ? ` Splatných šablón: ${dueCount}.`
            : " Momentálne nič nie je splatné."}
        </CardDescription>
        <CardAction className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={pending || dueCount === 0}
          >
            <Play className="size-4" />
            Zapísať splatné
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" />
            Pridať
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {recurringTrips.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Zatiaľ žiadne pravidelné jazdy. Hodia sa na dochádzku, rozvoz alebo
            opakovanú návštevu klienta.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trasa</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Najbližšie</TableHead>
                <TableHead className="text-right">Vzdialenosť</TableHead>
                <TableHead>Účel</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-20 text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurringTrips.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.origin || r.destination
                      ? `${r.origin ?? "—"} → ${r.destination ?? "—"}`
                      : "—"}
                    {r.round_trip ? (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        (tam aj späť)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {TRIP_CADENCE_LABELS[r.cadence as Cadence]}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmtDate(r.next_run_on)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKm(r.distance_km)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.purpose === "business" ? "default" : "secondary"
                      }
                    >
                      {TRIP_PURPOSE_LABELS[r.purpose as TripPurpose]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.active ? (
                      <Badge variant="outline">Aktívna</Badge>
                    ) : (
                      <Badge variant="secondary">Pozastavená</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upraviť pravidelnú jazdu" : "Nová pravidelná jazda"}
            </DialogTitle>
            <DialogDescription>
              Stav tachometra tu nie je — šablóna ho nepozná. Doplníš ho na
              vygenerovanej jazde, ak ho vedieš.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rt-origin">Odkiaľ</Label>
                <Input
                  id="rt-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rt-destination">Kam</Label>
                <Input
                  id="rt-destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Interval</Label>
                <Select
                  value={cadence}
                  onValueChange={(v) => setCadence(v as Cadence)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIP_CADENCE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rt-next">Najbližší termín</Label>
                <Input
                  id="rt-next"
                  type="date"
                  value={nextRunOn}
                  onChange={(e) => setNextRunOn(e.target.value)}
                />
              </div>
            </div>

            {cadence === "custom" ? (
              <div className="grid gap-2">
                <Label htmlFor="rt-interval">Každých (dní)</Label>
                <Input
                  id="rt-interval"
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rt-distance">Vzdialenosť (km)</Label>
                <Input
                  id="rt-distance"
                  type="number"
                  step="0.1"
                  min={0}
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Účel</Label>
                <Select
                  value={purpose}
                  onValueChange={(v) => setPurpose(v as TripPurpose)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIP_PURPOSE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Klient</Label>
              <Select
                value={contactId || "none"}
                onValueChange={(v) => setContactId(v === "none" ? "" : (v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez klienta</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rt-note">Účel jazdy slovom</Label>
              <Input
                id="rt-note"
                value={purposeNote}
                onChange={(e) => setPurposeNote(e.target.value)}
                placeholder="pri daňovej kontrole je to to, čo sa číta"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="rt-roundtrip">Tam aj späť</Label>
              <Switch
                id="rt-roundtrip"
                checked={roundTrip}
                onCheckedChange={setRoundTrip}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rt-active">Aktívna</Label>
              <Switch
                id="rt-active"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={submit} disabled={pending}>
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
            <AlertDialogTitle>Zmazať pravidelnú jazdu?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmaže sa len šablóna. Jazdy, ktoré už z nej vznikli, zostávajú
              v knihe jázd nedotknuté.
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
    </Card>
  )
}
