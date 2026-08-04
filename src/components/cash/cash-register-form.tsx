"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  cashRegisterSchema,
  type CashRegisterValues,
} from "@/lib/validation/cash-register"
import {
  createCashRegister,
  updateCashRegister,
} from "@/app/actions/cash-registers"

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

type CashRegister = Database["public"]["Tables"]["cash_registers"]["Row"]

export function CashRegisterForm({
  register,
  onDone,
}: {
  register?: CashRegister | null
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<CashRegisterValues>({
    resolver: zodResolver(cashRegisterSchema),
    defaultValues: {
      name: register?.name ?? "",
      description: register?.description ?? "",
      currency: register?.currency ?? "EUR",
      active: register?.active ?? true,
    },
  })

  function onSubmit(values: CashRegisterValues) {
    startSubmit(async () => {
      const res = register
        ? await updateCashRegister(register.id, values)
        : await createCashRegister(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(register ? "Pokladňa upravená." : "Pokladňa vytvorená.")
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Názov</FormLabel>
              <FormControl>
                <Input placeholder="Napr. Hlavná pokladňa" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Popis</FormLabel>
                <FormControl>
                  <Input placeholder="Napr. predajňa Bratislava" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mena</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Aktívna pokladňa</FormLabel>
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
            {register ? "Uložiť" : "Vytvoriť"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
