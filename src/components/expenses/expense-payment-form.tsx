"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Undo2, Trash2, Landmark } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  expensePaymentSchema,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  type ExpensePaymentValues,
} from "@/lib/validation/expense-payment"
import { remainingToPay } from "@/lib/expenses/payment"
import { formatMoney } from "@/lib/money"
import {
  recordExpensePayment,
  clearExpensePayments,
  deleteExpensePayment,
} from "@/app/actions/expenses"

import { Badge } from "@/components/ui/badge"
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

type Expense = Database["public"]["Tables"]["expenses"]["Row"]
type ExpensePayment = Database["public"]["Tables"]["expense_payments"]["Row"]

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ExpensePaymentForm({
  expense,
  payments = [],
  onDone,
}: {
  expense: Expense
  /** Uz zaevidovane uhrady — `expenses.paid_amount` je ich sucet. */
  payments?: ExpensePayment[]
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()
  const [clearing, startClear] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [confirmClear, setConfirmClear] = useState(false)

  const remaining = remainingToPay(expense.paid_amount, expense.total)

  const form = useForm<ExpensePaymentValues>({
    resolver: zodResolver(expensePaymentSchema),
    defaultValues: {
      expenseId: expense.id,
      // Prednastavime zvysok — najcastejsi pripad je doplatenie do plnej sumy.
      amount: remaining,
      paidAt: today(),
      method: "bank",
      note: "",
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
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Úhrady zrušené.")
        onDone()
      }
      setConfirmClear(false)
    })
  }

  function handleDeleteOne(paymentId: string) {
    startDelete(async () => {
      const res = await deleteExpensePayment(paymentId)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Úhrada zrušená.")
        onDone()
      }
    })
  }

  const busy = submitting || clearing || deleting

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

        {payments.length > 0 ? (
          <div className="grid gap-1">
            <FormLabel>Zaevidované úhrady</FormLabel>
            <ul className="grid gap-1">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="bg-muted/30 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <span className="tabular-nums">{fmtDate(p.paid_at)}</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(p.amount, expense.currency)}
                  </span>
                  <Badge variant="outline">
                    {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ??
                      p.method}
                  </Badge>
                  {p.bank_transaction_id ? (
                    <Badge variant="secondary" title="Z bankového výpisu">
                      <Landmark className="size-3" />
                      banka
                    </Badge>
                  ) : null}
                  {p.note ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {p.note}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    onClick={() => handleDeleteOne(p.id)}
                    disabled={busy}
                    title="Zrušiť túto úhradu"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
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
          <FormField
            control={form.control}
            name="paidAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dátum úhrady</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spôsob</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: PaymentMethod) => PAYMENT_METHOD_LABELS[v]}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between gap-2">
          {payments.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmClear(true)}
              disabled={busy}
            >
              {clearing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Undo2 className="size-4" />
              )}
              Zrušiť všetky
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onDone}>
              Zavrieť
            </Button>
            <Button type="submit" disabled={busy}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Zapísať úhradu
            </Button>
          </div>
        </div>
      </form>

      {/* Mazanie vsetkych uhrad je nevratne, tak sa naň pýtame — mazanie
          samotneho nakladu potvrdenie ma uz dlhsie. */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zrušiť všetky úhrady?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmaže sa {payments.length}{" "}
              {payments.length === 1
                ? "zaevidovaná úhrada"
                : payments.length < 5
                  ? "zaevidované úhrady"
                  : "zaevidovaných úhrad"}{" "}
              vrátane tých z bankového výpisu. Náklad sa vráti na neuhradený.
              Platby z banky sa dajú zaúčtovať znova opätovným importom výpisu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} disabled={busy}>
              Zmazať úhrady
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  )
}
