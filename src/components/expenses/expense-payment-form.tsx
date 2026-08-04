"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  expensePaymentSchema,
  type ExpensePaymentValues,
} from "@/lib/validation/expense-payment"
import { remainingToPay } from "@/lib/expenses/payment"
import { formatMoney } from "@/lib/money"
import {
  recordExpensePayment,
  clearExpensePayments,
} from "@/app/actions/expenses"

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

type Expense = Database["public"]["Tables"]["expenses"]["Row"]

export function ExpensePaymentForm({
  expense,
  onDone,
}: {
  expense: Expense
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()
  const [clearing, startClear] = useTransition()

  const remaining = remainingToPay(expense.paid_amount, expense.total)

  const form = useForm<ExpensePaymentValues>({
    resolver: zodResolver(expensePaymentSchema),
    defaultValues: {
      expenseId: expense.id,
      // Prednastavime zvysok — najcastejsi pripad je doplatenie do plnej sumy.
      amount: remaining,
    },
  })

  function onSubmit(values: ExpensePaymentValues) {
    startSubmit(async () => {
      const res = await recordExpensePayment(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Úhrada zapísaná.")
      onDone()
    })
  }

  function handleClear() {
    startClear(async () => {
      const res = await clearExpensePayments(expense.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Úhrady zrušené.")
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-1 rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Suma dokladu</span>
            <span className="tabular-nums">
              {formatMoney(expense.total, expense.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Už uhradené</span>
            <span className="tabular-nums">
              {formatMoney(expense.paid_amount, expense.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between font-medium">
            <span>Zostáva</span>
            <span className="tabular-nums">
              {formatMoney(remaining, expense.currency)}
            </span>
          </div>
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Uhradená suma</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min={0} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between gap-2">
          {expense.paid_amount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={clearing || submitting}
            >
              {clearing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Undo2 className="size-4" />
              )}
              Zrušiť úhrady
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onDone}>
              Zavrieť
            </Button>
            <Button type="submit" disabled={submitting || clearing}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Zapísať úhradu
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
