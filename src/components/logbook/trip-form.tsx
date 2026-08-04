"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  tripSchema,
  TRIP_PURPOSES,
  TRIP_PURPOSE_LABELS,
  type TripPurpose,
  type TripValues,
} from "@/lib/validation/trip"
import { createTrip, updateTrip } from "@/app/actions/trips"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Trip = Database["public"]["Tables"]["trips"]["Row"]

export type ContactOption = { id: string; name: string }

// Prazdna volba v Selecte — prazdny retazec si formular pletie s "nevyplnene",
// tak pouzivame sentinel a mapujeme ho na undefined.
const NONE = "none"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TripForm({
  vehicleId,
  trip,
  contacts,
  onDone,
}: {
  vehicleId: string
  trip?: Trip | null
  contacts: ContactOption[]
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      vehicleId: trip?.vehicle_id ?? vehicleId,
      tripDate: trip?.trip_date ?? today(),
      origin: trip?.origin ?? "",
      destination: trip?.destination ?? "",
      contactId: trip?.contact_id ?? undefined,
      distanceKm: trip?.distance_km ?? 0,
      roundTrip: trip?.round_trip ?? true,
      purpose: (trip?.purpose as TripPurpose | undefined) ?? "business",
      purposeNote: trip?.purpose_note ?? "",
      driverName: trip?.driver_name ?? "",
      odometerStartKm: trip?.odometer_start_km ?? undefined,
      odometerEndKm: trip?.odometer_end_km ?? undefined,
    },
  })

  const purpose = form.watch("purpose")

  function onSubmit(values: TripValues) {
    startSubmit(async () => {
      const res = trip
        ? await updateTrip(trip.id, values)
        : await createTrip(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(trip ? "Jazda upravená." : "Jazda zapísaná.")
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="tripDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dátum</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ jazdy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          TRIP_PURPOSE_LABELS[v as TripPurpose] ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TRIP_PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {TRIP_PURPOSE_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {purpose === "private" ? (
          <p className="text-muted-foreground flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>
              Súkromná jazda sa <strong>nezapočíta</strong> do daňovo
              uznateľných nákladov. Evidujeme ju len preto, aby sedel stav
              tachometra.
            </span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="origin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Odkiaľ</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Napr. Bratislava"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="destination"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kam</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Napr. Košice"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="contactId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Klient (voliteľné)</FormLabel>
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) =>
                    field.onChange(v === NONE ? undefined : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          contacts.find((c) => c.id === v)?.name ?? "—"
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="distanceKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dĺžka jazdy (km)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="purposeNote"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Účel jazdy</FormLabel>
              <FormControl>
                <Input
                  placeholder="Napr. obhliadka u klienta"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="driverName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vodič</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="odometerStartKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tachometer začiatok</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="odometerEndKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tachometer koniec</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="roundTrip"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Tam aj späť</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Zrušiť
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {trip ? "Uložiť" : "Zapísať"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
