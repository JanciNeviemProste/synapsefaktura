"use client"

import { useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2, FileText } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { documentSchema, type DocumentValues } from "@/lib/validation/document"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import { documentPresentation } from "@/lib/documents/presentation"
import { VAT_MODE_LABELS, type VatMode } from "@/lib/validation/org"
import { CURRENT_VAT_RATES, vatRateLabel } from "@/lib/vat/rates"
import { computeInvoice } from "@/lib/vat/engine"
import { legalNoteForVatMode } from "@/lib/vat/legal-notes"
import { formatMoney } from "@/lib/money"
import { saveDocument } from "@/app/actions/documents"
import { useUpgrade } from "@/components/billing/upgrade-dialog"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

type Contact = Database["public"]["Tables"]["contacts"]["Row"]
type Product = Database["public"]["Tables"]["products"]["Row"]
type DocRow = Database["public"]["Tables"]["documents"]["Row"]
type ItemRow = Database["public"]["Tables"]["document_items"]["Row"]

// "draft" je aj stav dokladu (document_status), nie realny typ dokladu. Doklad
// ulozeny s type="draft" vypadne z kazdeho dotazu filtrovaneho na type="invoice"
// (dashboard, vykazy), takze si ho pouzivatel nechtiac schova. Koncept sa robi
// ulozenim bez vystavenia (saveDocument s issue:false), nie volbou typu.
// V DOCUMENT_TYPE_LABELS "draft" zostava, aby sa stare zaznamy dali zobrazit.
const HIDDEN_DOCUMENT_TYPES: DocumentType[] = ["draft"]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function InvoiceEditor({
  contacts,
  products,
  defaultVatMode,
  defaultDueDays,
  document: doc,
  items: existingItems,
}: {
  contacts: Contact[]
  products: Product[]
  defaultVatMode: VatMode
  defaultDueDays: number
  document?: DocRow | null
  items?: ItemRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<DocumentValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      type: (doc?.type as DocumentType) ?? "invoice",
      contactId: doc?.contact_id ?? undefined,
      issueDate: doc?.issue_date ?? today(),
      supplyDate: doc?.supply_date ?? "",
      dueDate: doc?.due_date ?? addDays(today(), defaultDueDays),
      currency: doc?.currency ?? "EUR",
      exchangeRate: doc?.exchange_rate ?? 1,
      language: doc?.language ?? "sk",
      vatMode: (doc?.vat_mode as VatMode) ?? defaultVatMode,
      notes: doc?.notes ?? "",
      footerNotes: doc?.footer_notes ?? "",
      // `null` = "podla typu dokladu". Nie `false`, ani `true`.
      showPrices: doc?.show_prices ?? null,
      items:
        existingItems && existingItems.length
          ? existingItems.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unit: i.unit,
              unitPrice: i.unit_price,
              vatRate: i.vat_rate,
              discountPct: i.discount_pct,
              productId: i.product_id,
            }))
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
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedItems = useWatch({ control: form.control, name: "items" })
  const type = useWatch({ control: form.control, name: "type" })
  const vatMode = useWatch({ control: form.control, name: "vatMode" })
  const currency = useWatch({ control: form.control, name: "currency" })
  const language = useWatch({ control: form.control, name: "language" })

  const totals = useMemo(() => {
    return computeInvoice(
      (watchedItems ?? []).map((i) => ({
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        vatRate: Number(i.vatRate) || 0,
        discountPct: Number(i.discountPct) || 0,
      })),
      vatMode as VatMode,
    )
  }, [watchedItems, vatMode])

  // Skryte typy sa ponukaju len vtedy, ak taky typ uz ma nacitany doklad -
  // inak by Select tichu hodnotu prepisal alebo ju nemal cim zobrazit.
  const typeOptions = useMemo(() => {
    const keys = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]
    return keys.filter(
      (t) => !HIDDEN_DOCUMENT_TYPES.includes(t) || t === doc?.type,
    )
  }, [doc?.type])

  const showPrices = useWatch({ control: form.control, name: "showPrices" })
  const docType = (type as DocumentType) ?? "invoice"
  const presentation = documentPresentation(docType, { showPrices })
  // Co by doklad robil bez vedomeho nastavenia — podla toho vieme pomenovat,
  // ci je prepinac zapnuty proti svojmu typu.
  const typeDefaultShowsPrices = documentPresentation(docType).showPrices

  const legalNote = legalNoteForVatMode(
    vatMode as VatMode,
    language === "en" ? "en" : "sk",
  )

  function addFromProduct(productId: string | null) {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    append({
      description: p.name,
      quantity: 1,
      unit: p.unit,
      unitPrice: p.unit_price,
      vatRate: p.vat_rate,
      discountPct: 0,
      productId: p.id,
    })
  }

  const { prompt } = useUpgrade()

  function submit(issue: boolean) {
    form.handleSubmit((values) => {
      startTransition(async () => {
        // Splatnost sa pri neplatobnom type v UI nezobrazuje, tak ju ani
        // neukladame - inak by v DB ostala hodnota, ktoru pouzivatel nevidel.
        const payload = documentPresentation(values.type, {
          showPrices: values.showPrices,
        }).isPayable
          ? values
          : { ...values, dueDate: "" }
        const res = await saveDocument(payload, { id: doc?.id, issue })
        if (!res.ok) {
          if (res.upgrade) prompt(res.upgrade, res.error)
          else toast.error(res.error)
          return
        }
        toast.success(issue ? "Doklad vystavený." : "Koncept uložený.")
        router.push(`/app/invoices/${res.id}`)
      })
    })()
  }

  return (
    <Form {...form}>
      <form className="mx-auto grid max-w-5xl gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            {doc ? "Upraviť doklad" : "Nový doklad"}
          </h1>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => submit(false)}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Uložiť koncept
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => submit(true)}
            >
              <FileText className="size-4" />
              Vystaviť
            </Button>
          </div>
        </div>

        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hlavička</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ dokladu</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: DocumentType) => DOCUMENT_TYPE_LABELS[v]}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typeOptions.map((v) => (
                        <SelectItem key={v} value={v}>
                          {DOCUMENT_TYPE_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
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
                      {contacts.length === 0 ? (
                        <div className="text-muted-foreground p-2 text-sm">
                          Žiadne kontakty
                        </div>
                      ) : (
                        contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vatMode"
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
            <div className="grid grid-cols-3 gap-2">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mena</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kurz</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.000001" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jazyk</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="issueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dátum vystavenia</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div
              className={
                presentation.isPayable ? "grid grid-cols-2 gap-2" : "grid gap-2"
              }
            >
              <FormField
                control={form.control}
                name="supplyDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dátum dodania (DUZP)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {/* Cenova ponuka, objednavky a dodaci list nikoho nevyzyvaju
                  na platbu, splatnost pre ne nema zmysel. */}
              {presentation.isPayable && (
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Položky</CardTitle>
            {products.length > 0 && (
              <Select value="" onValueChange={addFromProduct}>
                <SelectTrigger className="w-48" size="sm">
                  <SelectValue placeholder="Pridať z cenníka" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="text-muted-foreground hidden grid-cols-[1fr_70px_60px_90px_80px_70px_100px_32px] gap-2 px-1 text-xs font-medium sm:grid">
              <span>Popis</span>
              <span>Množ.</span>
              <span>MJ</span>
              <span>Cena/j.</span>
              <span>DPH</span>
              <span>Zľava%</span>
              <span className="text-right">Spolu</span>
              <span />
            </div>
            {fields.map((f, idx) => {
              const line = totals.lines[idx]
              return (
                <div
                  key={f.id}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_70px_60px_90px_80px_70px_100px_32px] sm:items-center"
                >
                  <Input
                    placeholder="Popis položky"
                    className="col-span-2 sm:col-span-1"
                    {...form.register(`items.${idx}.description`)}
                  />
                  <Input
                    type="number"
                    step="0.001"
                    {...form.register(`items.${idx}.quantity`)}
                  />
                  <Input {...form.register(`items.${idx}.unit`)} />
                  <Input
                    type="number"
                    step="0.0001"
                    {...form.register(`items.${idx}.unitPrice`)}
                  />
                  <select
                    className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                    {...form.register(`items.${idx}.vatRate`)}
                  >
                    {CURRENT_VAT_RATES.map((r) => (
                      <option key={r} value={r}>
                        {vatRateLabel(r)}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register(`items.${idx}.discountPct`)}
                  />
                  <span className="text-right text-sm font-medium tabular-nums">
                    {formatMoney(line?.lineTotal ?? 0, currency)}
                  </span>
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
              )
            })}
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
            {form.formState.errors.items?.message && (
              <p className="text-destructive text-sm">
                {form.formState.errors.items.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recap + totals */}
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <p className="text-sm font-medium">Daňová rekapitulácia</p>
              <div className="grid gap-1 text-sm">
                {totals.recap.map((r) => (
                  <div
                    key={r.rate}
                    className="text-muted-foreground flex justify-between"
                  >
                    <span>Základ {r.rate} %</span>
                    <span className="tabular-nums">
                      {formatMoney(r.base, currency)} + DPH{" "}
                      {formatMoney(r.vat, currency)}
                    </span>
                  </div>
                ))}
              </div>
              {legalNote && (
                <p className="text-muted-foreground mt-2 text-xs italic">
                  {legalNote}
                </p>
              )}
            </div>
            <div className="grid gap-1 sm:justify-items-end">
              <div className="flex w-full max-w-xs justify-between text-sm">
                <span className="text-muted-foreground">Základ spolu</span>
                <span className="tabular-nums">
                  {formatMoney(totals.subtotal, currency)}
                </span>
              </div>
              <div className="flex w-full max-w-xs justify-between text-sm">
                <span className="text-muted-foreground">DPH spolu</span>
                <span className="tabular-nums">
                  {formatMoney(totals.vatTotal, currency)}
                </span>
              </div>
              <div className="flex w-full max-w-xs justify-between border-t pt-1 text-base font-semibold">
                <span>Spolu na úhradu</span>
                <span className="tabular-nums">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tlac */}
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-2">
              <Label>Ceny na doklade</Label>
              <Select
                value={
                  showPrices === null || showPrices === undefined
                    ? "auto"
                    : showPrices
                      ? "yes"
                      : "no"
                }
                onValueChange={(v) =>
                  form.setValue(
                    "showPrices",
                    v === "auto" ? null : v === "yes",
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Podľa typu dokladu (
                    {typeDefaultShowsPrices ? "s cenami" : "bez cien"})
                  </SelectItem>
                  <SelectItem value="yes">Vždy tlačiť ceny</SelectItem>
                  <SelectItem value="no">Netlačiť ceny</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Dodací list sa bežne tlačí bez cien, časť odberateľov ich však
                chce. Bez cien sa nevytlačí ani rekapitulácia DPH a platobný QR
                kód — nesie sumu, ktorú by doklad neuvádzal.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-2">
              <Label>Poznámka</Label>
              <Textarea rows={2} {...form.register("notes")} />
            </div>
            <div className="grid gap-2">
              <Label>Pätička</Label>
              <Textarea rows={2} {...form.register("footerNotes")} />
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
