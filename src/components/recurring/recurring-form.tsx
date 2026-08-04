"use client"

import { useTransition } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  recurringSchema,
  CADENCE_LABELS,
  RECURRING_SEND_METHOD_LABELS,
  type RecurringSendMethod,
  type RecurringValues,
} from "@/lib/validation/recurring"
import { VAT_MODE_LABELS, type VatMode } from "@/lib/validation/org"
import { CURRENT_VAT_RATES, vatRateLabel } from "@/lib/vat/rates"
import { SUPPORTED_MERGE_TAGS } from "@/lib/recurring/merge-tags"
import { createRecurring, updateRecurring } from "@/app/actions/recurring"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

type Recurring = Database["public"]["Tables"]["recurring_invoices"]["Row"]
type Contact = { id: string; name: string }
type Cadence = keyof typeof CADENCE_LABELS

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function RecurringForm({
  recurring,
  contacts,
  onDone,
}: {
  recurring?: Recurring | null
  contacts: Contact[]
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()
  const tpl = (recurring?.template ?? {}) as Partial<
    RecurringValues["template"]
  >

  const form = useForm<RecurringValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      name: recurring?.name ?? "",
      contactId: recurring?.contact_id ?? undefined,
      cadence: (recurring?.cadence as Cadence) ?? "monthly",
      intervalDays: recurring?.interval_days ?? undefined,
      nextRunAt: recurring?.next_run_at ?? today(),
      active: recurring?.active ?? true,
      sendMethod: recurring?.send_method ?? "none",
      template: {
        vatMode: (tpl.vatMode as VatMode) ?? "payer",
        currency: tpl.currency ?? "EUR",
        language: tpl.language ?? "sk",
        dueDays: tpl.dueDays ?? 14,
        notes: tpl.notes ?? "",
        items:
          tpl.items && tpl.items.length
            ? tpl.items
            : [
                {
                  description: "",
                  quantity: 1,
                  unit: "ks",
                  unitPrice: 0,
                  vatRate: 23,
                  discountPct: 0,
                },
              ],
      },
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "template.items",
  })
  const cadence = form.watch("cadence")

  function onSubmit(values: RecurringValues) {
    startSubmit(async () => {
      const res = recurring
        ? await updateRecurring(recurring.id, values)
        : await createRecurring(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(recurring ? "Uložené." : "Pravidelná faktúra vytvorená.")
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
                <Input placeholder="Napr. Mesačný paušál" {...field} />
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
                <FormLabel>Odberateľ</FormLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Vyber kontakt">
                        {(v: string) =>
                          contacts.find((c) => c.id === v)?.name ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="template.vatMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Režim DPH</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: VatMode) => VAT_MODE_LABELS[v]}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(VAT_MODE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="cadence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interval</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: Cadence) => CADENCE_LABELS[v]}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(CADENCE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {cadence === "custom" && (
            <FormField
              control={form.control}
              name="intervalDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Každých (dní)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="nextRunAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Najbližšie vystavenie</FormLabel>
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
          name="sendMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Po vystavení</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: RecurringSendMethod) =>
                        RECURRING_SEND_METHOD_LABELS[v]
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(RECURRING_SEND_METHOD_LABELS).map(
                    ([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {field.value === "email"
                  ? "Faktúra odíde odberateľovi automaticky aj s PDF prílohou. Musí mať vyplnený e-mail."
                  : field.value === "peppol"
                    ? "Peppol zatiaľ nie je v cron behu podporený — doklad sa vystaví a zostane na ručné odoslanie."
                    : "Doklad sa len vystaví. Odoslať ho môžeš ručne z jeho detailu."}
              </p>
            </FormItem>
          )}
        />

        {/* Items */}
        <div className="grid gap-2">
          <FormLabel>Položky</FormLabel>
          <p className="text-muted-foreground text-xs">
            Tagy v popise: {SUPPORTED_MERGE_TAGS.join(", ")}
          </p>
          {fields.map((f, idx) => (
            <div
              key={f.id}
              className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_70px_90px_80px_32px] sm:items-center"
            >
              <Input
                placeholder="Popis (napr. Paušál za #MESIAC_SLOVOM#)"
                className="col-span-2 sm:col-span-1"
                {...form.register(`template.items.${idx}.description`)}
              />
              <Input
                type="number"
                step="0.001"
                {...form.register(`template.items.${idx}.quantity`)}
              />
              <Input
                type="number"
                step="0.0001"
                {...form.register(`template.items.${idx}.unitPrice`)}
              />
              <select
                className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                {...form.register(`template.items.${idx}.vatRate`)}
              >
                {CURRENT_VAT_RATES.map((r) => (
                  <option key={r} value={r}>
                    {vatRateLabel(r)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(idx)}
                disabled={fields.length === 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              append({
                description: "",
                quantity: 1,
                unit: "ks",
                unitPrice: 0,
                vatRate: 23,
                discountPct: 0,
              })
            }
          >
            <Plus className="size-4" />
            Pridať položku
          </Button>
        </div>

        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Aktívne</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="template.notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Poznámka</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
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
            {recurring ? "Uložiť" : "Vytvoriť"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
