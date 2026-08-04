"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney, round2 } from "@/lib/money"
import {
  refuelingSchema,
  type RefuelingValues,
} from "@/lib/validation/refueling"
import { createRefueling, updateRefueling } from "@/app/actions/refuelings"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

type Refueling = Database["public"]["Tables"]["refuelings"]["Row"]

export type ExpenseOption = {
  id: string
  document_number: string | null
  total: number
  currency: string
}

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

export function RefuelingForm({
  vehicleId,
  refueling,
  expenses,
  onDone,
}: {
  vehicleId: string
  refueling?: Refueling | null
  expenses: ExpenseOption[]
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<RefuelingValues>({
    resolver: zodResolver(refuelingSchema),
    defaultValues: {
      vehicleId: refueling?.vehicle_id ?? vehicleId,
      refueledAt: refueling?.refueled_at ?? today(),
      litres: refueling?.litres ?? 0,
      pricePerLitre: refueling?.price_per_litre ?? 0,
      totalPrice: refueling?.total_price ?? undefined,
      odometerKm: refueling?.odometer_km ?? undefined,
      expenseId: refueling?.expense_id ?? undefined,
    },
  })

  /**
   * Celkovu sumu dopocitavame z litrov a ceny za liter — pouzivatel ju vie
   * prepisat (na pumpe sa castka casto zaokruhluje), ale nesmie ostat prazdna.
   */
  function recalcTotal(litres: unknown, pricePerLitre: unknown) {
    const l = Number(litres)
    const p = Number(pricePerLitre)
    if (!Number.isFinite(l) || !Number.isFinite(p)) return
    form.setValue("totalPrice", round2(l * p), { shouldValidate: false })
  }

  function onSubmit(values: RefuelingValues) {
    startSubmit(async () => {
      const res = refueling
        ? await updateRefueling(refueling.id, values)
        : await createRefueling(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(refueling ? "Tankovanie upravené." : "Tankovanie zapísané.")
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="refueledAt"
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
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="litres"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Litre</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      recalcTotal(
                        e.target.value,
                        form.getValues("pricePerLitre"),
                      )
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pricePerLitre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cena za liter</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0001"
                    min={0}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      recalcTotal(form.getValues("litres"), e.target.value)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Celková suma</FormLabel>
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
        </div>

        <FormField
          control={form.control}
          name="expenseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Náklad (voliteľné)</FormLabel>
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
            {refueling ? "Uložiť" : "Zapísať"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
