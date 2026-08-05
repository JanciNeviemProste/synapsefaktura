"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  vehicleSchema,
  FUEL_TYPES,
  FUEL_TYPE_LABELS,
  VEHICLE_OWNERSHIPS,
  VEHICLE_OWNERSHIP_LABELS,
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_LABELS,
  type VehicleValues,
} from "@/lib/validation/vehicle"
import { createVehicle, updateVehicle } from "@/app/actions/vehicles"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormDescription,
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

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"]

export function VehicleForm({
  vehicle,
  onDone,
}: {
  vehicle?: Vehicle | null
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      name: vehicle?.name ?? "",
      licensePlate: vehicle?.license_plate ?? "",
      fuelType: vehicle?.fuel_type ?? "petrol",
      ownership: vehicle?.ownership ?? "company",
      category: vehicle?.category ?? "passenger",
      driverName: vehicle?.driver_name ?? "",
      // Zamerne `undefined`, nie 0 — nevyplnena spotreba nie je nulova spotreba.
      consumptionL100Km: vehicle?.consumption_l_100km ?? undefined,
      odometerKm: vehicle?.odometer_km ?? 0,
      vin: vehicle?.vin ?? "",
      note: vehicle?.note ?? "",
      active: vehicle?.active ?? true,
    },
  })

  function onSubmit(values: VehicleValues) {
    startSubmit(async () => {
      const res = vehicle
        ? await updateVehicle(vehicle.id, values)
        : await createVehicle(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(vehicle ? "Vozidlo upravené." : "Vozidlo pridané.")
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Názov / popis</FormLabel>
                <FormControl>
                  <Input placeholder="Napr. Škoda Octavia" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="licensePlate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ECV</FormLabel>
                <FormControl>
                  <Input placeholder="BA123AB" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fuelType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Palivo</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          FUEL_TYPE_LABELS[v as keyof typeof FUEL_TYPE_LABELS]
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FUEL_TYPES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FUEL_TYPE_LABELS[f]}
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
            name="ownership"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vlastník</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          VEHICLE_OWNERSHIP_LABELS[
                            v as keyof typeof VEHICLE_OWNERSHIP_LABELS
                          ]
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VEHICLE_OWNERSHIPS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {VEHICLE_OWNERSHIP_LABELS[o]}
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
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kategória</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          VEHICLE_CATEGORY_LABELS[
                            v as keyof typeof VEHICLE_CATEGORY_LABELS
                          ]
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VEHICLE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {VEHICLE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Rozhoduje o sadzbe cestovnej náhrady — zákon má pre motocykel
                  výrazne nižšiu než pre osobné auto.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="consumptionL100Km"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spotreba (l/100 km)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="6,50"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  Kombinovaná spotreba z technického preukazu. Daňovo uznať sa
                  dá len to nižšie z dvojice: km × táto spotreba, alebo reálne
                  nakúpené palivo.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="odometerKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aktuálny stav tachometra (km)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="driverName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Predvolený vodič</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VIN</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Poznámka</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Vozidlo v prevádzke</FormLabel>
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
            {vehicle ? "Uložiť" : "Pridať"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
