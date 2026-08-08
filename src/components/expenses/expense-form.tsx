"use client"

import { useState, useTransition } from "react"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Paperclip, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  expenseSchema,
  EXPENSE_CATEGORIES,
  type ExpenseValues,
} from "@/lib/validation/expense"
import { CURRENT_VAT_RATES, vatRateLabel } from "@/lib/vat/rates"
import { round2, formatMoney } from "@/lib/money"
import { computeExpenseItems } from "@/lib/expenses/items"
import { MAX_ATTACHMENT_BYTES, tooLargeMessage } from "@/lib/upload/limits"
import { uploadDirect } from "@/lib/upload/direct"
import { createExpense, updateExpense } from "@/app/actions/expenses"

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

type ExpenseItem = Database["public"]["Tables"]["expense_items"]["Row"]

export function ExpenseForm({
  expense,
  expenseItems,
  suppliers,
  onDone,
}: {
  expense?: Expense | null
  /** Ulozeny rozpis. Prazdny znamena naklad s jednou sumou. */
  expenseItems?: ExpenseItem[]
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
      // `undefined`, nie `[]` — prazdne pole by sa tvarilo ako zapnuty rozpis
      // bez poloziek a prepocet by naklad vynuloval.
      items:
        expenseItems && expenseItems.length > 0
          ? expenseItems.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unit: i.unit,
              unitPrice: i.unit_price,
              vatRate: i.vat_rate,
              accountCode: i.account_code ?? "",
              costCenter: i.cost_center ?? "",
              projectCode: i.project_code ?? "",
              activityCode: i.activity_code ?? "",
            }))
          : undefined,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const subtotal = Number(form.watch("subtotal")) || 0
  const vatRate = Number(form.watch("vatRate")) || 0
  const vat = round2((subtotal * vatRate) / 100)
  const total = round2(subtotal + vat)

  const watchedItems = useWatch({ control: form.control, name: "items" })
  const itemized = (watchedItems?.length ?? 0) > 0

  // Ten isty prepocet ako na serveri — cista funkcia, ziadna druha
  // implementacia. Nahlad tak nemoze ukazat ine cislo, nez sa ulozi.
  const itemTotals = itemized
    ? computeExpenseItems(
        (watchedItems ?? []).map((i) => ({
          description: i.description ?? "",
          quantity: Number(i.quantity) || 0,
          unit: i.unit ?? "ks",
          unitPrice: Number(i.unitPrice) || 0,
          vatRate: Number(i.vatRate) || 0,
          accountCode: i.accountCode,
          costCenter: i.costCenter,
          projectCode: i.projectCode,
          activityCode: i.activityCode,
        })),
      )
    : null

  const shownBase = itemTotals ? itemTotals.subtotal : subtotal
  const shownVat = itemTotals ? itemTotals.vat_total : vat
  const shownTotal = itemTotals ? itemTotals.total : total

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Pole sa cisti HNED, nie az po `await` — inak sa po zlyhani ten isty
    // subor neda vybrat druhy raz.
    e.target.value = ""
    if (!file) return

    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(tooLargeMessage(file.size, MAX_ATTACHMENT_BYTES))
      return
    }

    startUpload(async () => {
      try {
        // Priamo do uloziska — fotka blocka z mobilu (2-5 MB) by cez server
        // action neprelezla, Vercel ma strop 4,5 MB na telo poziadavky.
        const res = await uploadDirect("attachment", file)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setAttachmentPath(res.path)
        form.setValue("attachmentUrl", res.path)
        toast.success("Príloha nahraná.")
      } catch {
        toast.error("Súbor sa nepodarilo nahrať. Skús to znova.")
      }
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
          {itemized ? null : (
            <>
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
            </>
          )}
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

        {/* Rozpis na polozky — dodavatelska faktura s viacerymi sadzbami DPH */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <FormLabel>Rozpis položiek</FormLabel>
            {itemized ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      description: "",
                      quantity: 1,
                      unit: "ks",
                      unitPrice: 0,
                      vatRate: 23,
                    })
                  }
                >
                  <Plus className="size-4" />
                  Položka
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => form.setValue("items", undefined)}
                >
                  Zrušiť rozpis
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue("items", [
                    {
                      description: "",
                      quantity: 1,
                      // Prva polozka prevezme uz zadanu sumu a sadzbu, aby sa
                      // prepnutim na rozpis nestratilo, co uz pouzivatel vypisal.
                      unit: "ks",
                      unitPrice: subtotal,
                      vatRate,
                    },
                  ])
                }
              >
                <Plus className="size-4" />
                Rozpísať na položky
              </Button>
            )}
          </div>

          {itemized ? (
            <>
              <p className="text-muted-foreground text-xs">
                Základ, DPH aj celková suma sa počítajú z položiek — samostatné
                polia sa preto skryli.
              </p>
              {fields.map((f, i) => (
                <div
                  key={f.id}
                  className="grid grid-cols-2 items-end gap-2 sm:grid-cols-12"
                >
                  <div className="col-span-2 sm:col-span-4">
                    <Input
                      placeholder="Popis"
                      {...form.register(`items.${i}.description`)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="Množstvo"
                      {...form.register(`items.${i}.quantity`)}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Input
                      placeholder="MJ"
                      {...form.register(`items.${i}.unit`)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="Cena/MJ"
                      {...form.register(`items.${i}.unitPrice`)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                      {...form.register(`items.${i}.vatRate`)}
                    >
                      {CURRENT_VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {vatRateLabel(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                      title="Odstrániť položku"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* Uctovne clenenie — zabalene, aby riadok ostal citatelny. */}
                  <details className="col-span-2 sm:col-span-12">
                    <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-xs select-none">
                      Účtovné členenie položky
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <Input
                        placeholder="Účet"
                        {...form.register(`items.${i}.accountCode`)}
                      />
                      <Input
                        placeholder="Stredisko"
                        {...form.register(`items.${i}.costCenter`)}
                      />
                      <Input
                        placeholder="Zákazka"
                        {...form.register(`items.${i}.projectCode`)}
                      />
                      <Input
                        placeholder="Činnosť"
                        {...form.register(`items.${i}.activityCode`)}
                      />
                    </div>
                  </details>
                </div>
              ))}

              {itemTotals && itemTotals.vat_rate_breakdown.length > 1 ? (
                <div className="text-muted-foreground grid gap-0.5 text-xs">
                  {itemTotals.vat_rate_breakdown.map((r) => (
                    <span key={r.rate}>
                      {vatRateLabel(r.rate)}: základ{" "}
                      {formatMoney(r.base, form.watch("currency"))}, DPH{" "}
                      {formatMoney(r.vat, form.watch("currency"))}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="text-muted-foreground flex items-center justify-end gap-4 text-sm">
          <span>Základ: {formatMoney(shownBase, form.watch("currency"))}</span>
          <span>DPH: {formatMoney(shownVat, form.watch("currency"))}</span>
          <span className="text-foreground font-medium">
            Spolu: {formatMoney(shownTotal, form.watch("currency"))}
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
