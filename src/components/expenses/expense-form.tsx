"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Paperclip } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  expenseSchema,
  EXPENSE_CATEGORIES,
  type ExpenseValues,
} from "@/lib/validation/expense"
import { CURRENT_VAT_RATES, vatRateLabel } from "@/lib/vat/rates"
import { round2, formatMoney } from "@/lib/money"
import {
  createExpense,
  updateExpense,
  uploadAttachment,
} from "@/app/actions/expenses"

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

type Expense = Database["public"]["Tables"]["expenses"]["Row"]
type Supplier = { id: string; name: string }

export function ExpenseForm({
  expense,
  suppliers,
  onDone,
}: {
  expense?: Expense | null
  suppliers: Supplier[]
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()
  const [uploading, startUpload] = useTransition()
  const [attachmentPath, setAttachmentPath] = useState<string | null>(
    expense?.attachment_url ?? null,
  )

  const form = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      supplierContactId: expense?.supplier_contact_id ?? undefined,
      documentNumber: expense?.document_number ?? "",
      issueDate: expense?.issue_date ?? "",
      supplyDate: expense?.supply_date ?? "",
      dueDate: expense?.due_date ?? "",
      currency: expense?.currency ?? "EUR",
      subtotal: expense?.subtotal ?? 0,
      vatRate:
        (expense?.vat_rate_breakdown as { rate?: number }[] | null)?.[0]
          ?.rate ?? 23,
      category: expense?.category ?? "",
      taxDeductible: expense?.tax_deductible ?? true,
      notes: expense?.notes ?? "",
      attachmentUrl: expense?.attachment_url ?? "",
    },
  })

  const subtotal = Number(form.watch("subtotal")) || 0
  const vatRate = Number(form.watch("vatRate")) || 0
  const vat = round2((subtotal * vatRate) / 100)
  const total = round2(subtotal + vat)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    startUpload(async () => {
      const res = await uploadAttachment(fd)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setAttachmentPath(res.path)
      form.setValue("attachmentUrl", res.path)
      toast.success("Príloha nahraná.")
    })
  }

  function onSubmit(values: ExpenseValues) {
    startSubmit(async () => {
      const res = expense
        ? await updateExpense(expense.id, values)
        : await createExpense(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(expense ? "Náklad upravený." : "Náklad pridaný.")
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="supplierContactId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dodávateľ</FormLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Vyber dodávateľa">
                        {(v: string) =>
                          suppliers.find((s) => s.id === v)?.name ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {suppliers.length === 0 ? (
                      <div className="text-muted-foreground p-2 text-sm">
                        Žiadni dodávatelia
                      </div>
                    ) : (
                      suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="documentNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Číslo dokladu</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dátum vystavenia</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="supplyDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dátum dodania</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Splatnosť</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="subtotal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Základ (bez DPH)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vatRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DPH</FormLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => vatRateLabel(Number(v))}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENT_VAT_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {vatRateLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kategória</FormLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="—">
                        {(v: string) => v}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <div className="text-muted-foreground flex items-center justify-end gap-4 text-sm">
          <span>DPH: {formatMoney(vat, form.watch("currency"))}</span>
          <span className="text-foreground font-medium">
            Spolu: {formatMoney(total, form.watch("currency"))}
          </span>
        </div>

        <FormField
          control={form.control}
          name="taxDeductible"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Daňovo uznateľný náklad</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid gap-2">
          <FormLabel>Príloha (doklad)</FormLabel>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFile}
              disabled={uploading}
            />
            {uploading && <Loader2 className="size-4 animate-spin" />}
            {attachmentPath && !uploading && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Paperclip className="size-3" /> nahraté
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Zrušiť
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {expense ? "Uložiť" : "Pridať"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
