"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import {
  vehicleEventSchema,
  VEHICLE_EVENT_TYPES,
  VEHICLE_EVENT_TYPE_LABELS,
  type VehicleEventType,
  type VehicleEventValues,
} from "@/lib/validation/vehicle-event"
import {
  createVehicleEvent,
  updateVehicleEvent,
} from "@/app/actions/vehicle-events"
import type { ExpenseOption } from "./refueling-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

type VehicleEvent = Database["public"]["Tables"]["vehicle_events"]["Row"]

// Prazdna volba v Selecte — prazdny retazec si formular pletie s "nevyplnene".
const NONE = "none"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function expenseLabel(e: ExpenseOption): string {
  return `${e.document_number ?? "Bez čísla"} · ${formatMoney(
    e.total,
    e.currency,
  )}`
}

export function VehicleEventForm({
  vehicleId,
  event,
  expenses,
  onDone,
}: {
  vehicleId: string
  event?: VehicleEvent | null
  expenses: ExpenseOption[]
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<VehicleEventValues>({
    resolver: zodResolver(vehicleEventSchema),
    defaultValues: {
      vehicleId: event?.vehicle_id ?? vehicleId,
      type: (event?.type as VehicleEventType | undefined) ?? "service",
      eventDate: event?.event_date ?? today(),
      description: event?.description ?? "",
      cost: event?.cost ?? undefined,
      odometerKm: event?.odometer_km ?? undefined,
      expenseId: event?.expense_id ?? undefined,
      nextDueOn: event?.next_due_on ?? "",
    },
  })

  function onSubmit(values: VehicleEventValues) {
    startSubmit(async () => {
      const res = event
        ? await updateVehicleEvent(event.id, values)
        : await createVehicleEvent(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(event ? "Udalosť upravená." : "Udalosť zapísaná.")
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ udalosti</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          VEHICLE_EVENT_TYPE_LABELS[v as VehicleEventType] ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VEHICLE_EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {VEHICLE_EVENT_TYPE_LABELS[t]}
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
            name="eventDate"
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
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Popis</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Napr. výmena oleja a filtrov"
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
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Náklad</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
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
            name="odometerKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stav tachometra</FormLabel>
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
            name="nextDueOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ďalší termín</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="expenseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Náklad — doklad (voliteľné)</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) =>
                  field.onChange(v === NONE ? undefined : v)
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) => {
                        const e = expenses.find((x) => x.id === v)
                        return e ? expenseLabel(e) : "—"
                      }}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {expenses.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {expenseLabel(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Zrušiť
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {event ? "Uložiť" : "Zapísať"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
