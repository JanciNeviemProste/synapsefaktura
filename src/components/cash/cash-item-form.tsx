"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  cashItemSchema,
  CASH_DIRECTION_LABELS,
  type CashItemValues,
} from "@/lib/validation/cash-register"
import { formatMoney } from "@/lib/money"
import { createCashItem } from "@/app/actions/cash-registers"

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

export type CashRegisterOption = {
  id: string
  name: string
  currency: string
}
export type ContactOption = { id: string; name: string }
export type DocumentOption = {
  id: string
  number: string | null
  total: number
  currency: string
}
export type ExpenseOption = {
  id: string
  document_number: string | null
  total: number
  currency: string
}

// Prazdna volba v Selecte — hodnotu prazdneho retazca si formular pletie
// s "nevyplnene", tak pouzivame sentinel a mapujeme ho na undefined.
const NONE = "none"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CashItemForm({
  register,
  contacts,
  documents,
  expenses,
  onDone,
}: {
  register: CashRegisterOption
  contacts: ContactOption[]
  documents: DocumentOption[]
  expenses: ExpenseOption[]
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<CashItemValues>({
    resolver: zodResolver(cashItemSchema),
    defaultValues: {
      cashRegisterId: register.id,
      direction: "in",
      number: "",
      issuedOn: today(),
      amount: 0,
      vatAmount: 0,
      description: "",
      contactId: undefined,
      documentId: undefined,
      expenseId: undefined,
    },
  })

  const direction = form.watch("direction")

  function onSubmit(values: CashItemValues) {
    startSubmit(async () => {
      const res = await createCashItem(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        values.direction === "in"
          ? "Príjmový doklad zapísaný."
          : "Výdavkový doklad zapísaný.",
      )
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="direction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ dokladu</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    // Vazba na faktury vs. naklady sa s otocenim smeru neprenasa.
                    form.setValue("documentId", undefined)
                    form.setValue("expenseId", undefined)
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          CASH_DIRECTION_LABELS[v as "in" | "out"] ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="in">
                      {CASH_DIRECTION_LABELS.in}
                    </SelectItem>
                    <SelectItem value="out">
                      {CASH_DIRECTION_LABELS.out}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="issuedOn"
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

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Číslo dokladu</FormLabel>
                <FormControl>
                  <Input placeholder="Napr. PD2026/001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Suma s DPH ({register.currency})</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vatAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>z toho DPH</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min={0} {...field} />
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
                  placeholder="Za čo bola hotovosť prijatá / vydaná"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

          {direction === "in" ? (
            <FormField
              control={form.control}
              name="documentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Faktúra (voliteľné)</FormLabel>
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
                            const d = documents.find((x) => x.id === v)
                            return d ? (d.number ?? "Bez čísla") : "—"
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {documents.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {(d.number ?? "Bez čísla") +
                            " · " +
                            formatMoney(d.total, d.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
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
                            return e ? (e.document_number ?? "Bez čísla") : "—"
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {expenses.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {(e.document_number ?? "Bez čísla") +
                            " · " +
                            formatMoney(e.total, e.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Zrušiť
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Zapísať
          </Button>
        </div>
      </form>
    </Form>
  )
}
