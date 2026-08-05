"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2, FileText, UserPlus } from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ContactForm } from "@/components/contacts/contact-form"
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

const PRODUCT_LIST_ID = "cennik-polozky"

function today() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Polia uctovneho clenenia. Jedno miesto, aby sa hromadne vyplnenie a riadok
 *  polozky nemohli rozist. */
const ACCOUNTING_FIELDS = [
  { name: "accountCode", label: "Účet" },
  { name: "costCenter", label: "Stredisko" },
  { name: "projectCode", label: "Zákazka" },
  { name: "activityCode", label: "Činnosť" },
] as const

type AccountingValues = Record<(typeof ACCOUNTING_FIELDS)[number]["name"], string>

const ACCOUNTING_PLACEHOLDERS: AccountingValues = {
  accountCode: "napr. 602",
  costCenter: "napr. BA",
  projectCode: "napr. P-2026-01",
  activityCode: "napr. SLU",
}

function accountingPlaceholder(name: keyof AccountingValues): string {
  return ACCOUNTING_PLACEHOLDERS[name]
}

/** Kratke zhrnutie do zabaleneho riadku, aby bolo vidiet vyplnene clenenie
 *  bez rozbalovania kazdej polozky. */
function itemAccountingSummary(
  item?: Partial<AccountingValues> | null,
): string {
  if (!item) return ""
  const filled = ACCOUNTING_FIELDS.map((f) => item[f.name]?.trim()).filter(
    (v): v is string => Boolean(v),
  )
  return filled.length > 0 ? ` — ${filled.join(" · ")}` : ""
}

/** Predvyplni hromadne pole z PRVEJ polozky — pri doklade s jednotnym clenenim
 *  (co je bezny pripad) tak pouzivatel vidi to, co uz plati. */
function firstItemAccounting(
  items?: { account_code: string | null; cost_center: string | null; project_code: string | null; activity_code: string | null }[] | null,
): AccountingValues {
  const first = items?.[0]
  return {
    accountCode: first?.account_code ?? "",
    costCenter: first?.cost_center ?? "",
    projectCode: first?.project_code ?? "",
    activityCode: first?.activity_code ?? "",
  }
}

export function InvoiceEditor({
  contacts,
  products,
  defaultVatMode,
  defaultDueDays,
  document: doc,
  items: existingItems,
  initialType,
}: {
  contacts: Contact[]
  products: Product[]
  defaultVatMode: VatMode
  defaultDueDays: number
  document?: DocRow | null
  items?: ItemRow[]
  /**
   * Typ z adresy (`/app/invoices/new?type=delivery_note`). Bez neho zacinal
   * kazdy novy doklad ako faktura, aj ked pouzivatel prisiel z „Dodacie listy".
   */
  initialType?: DocumentType
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<DocumentValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      type: (doc?.type as DocumentType) ?? initialType ?? "invoice",
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
              accountCode: i.account_code ?? "",
              costCenter: i.cost_center ?? "",
              projectCode: i.project_code ?? "",
              activityCode: i.activity_code ?? "",
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

  // Uctovne clenenie sedi na polozke. Tento stav je len HROMADNE VYPLNENIE —
  // do formulara sa dostane az kliknutim, aby sa nestalo, ze pisanie hore
  // ticho prepise clenenie, ktore si niekto nastavil po riadkoch.
  const [bulkAccounting, setBulkAccounting] = useState<AccountingValues>(() =>
    firstItemAccounting(existingItems),
  )

  function applyAccountingToAll() {
    const count = form.getValues("items").length
    for (let i = 0; i < count; i++) {
      for (const f of ACCOUNTING_FIELDS) {
        form.setValue(`items.${i}.${f.name}`, bulkAccounting[f.name], {
          shouldDirty: true,
        })
      }
    }
    toast.success(
      count === 1
        ? "Členenie použité na položku."
        : `Členenie použité na ${count} položiek.`,
    )
  }

  // Kontakty sa drzia v stave, aby sa novo vytvoreny dal hned vybrat bez
  // reloadu — server prop je staticky na cas zivota stranky.
  const [contactList, setContactList] = useState<Contact[]>(contacts)
  const [newContactOpen, setNewContactOpen] = useState(false)

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

  /**
   * Ked pouzivatel vyberie polozku z nasepkavaca (alebo napise presne jej
   * nazov), doplnia sa aj MJ, cena a sadzba DPH. Bez toho by nasepkavac
   * setril len pisanie popisu a cenu by aj tak musel dohladat.
   *
   * Porovnava sa normalizovane, aby „doprava" naslo „Doprava".
   */
  function applyProductByName(idx: number, name: string) {
    const needle = name.trim().replace(/\s+/g, " ").toLowerCase()
    if (needle === "") return
    const p = products.find(
      (x) => x.name.trim().replace(/\s+/g, " ").toLowerCase() === needle,
    )
    if (!p) return
    form.setValue(`items.${idx}.unit`, p.unit, { shouldDirty: true })
    form.setValue(`items.${idx}.unitPrice`, p.unit_price, { shouldDirty: true })
    form.setValue(`items.${idx}.vatRate`, p.vat_rate, { shouldDirty: true })
    form.setValue(`items.${idx}.productId`, p.id, { shouldDirty: true })
  }

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
          <div>
            {/* Nadpis musi povedat, aky doklad sa prave vystavuje. Doteraz tu
                bolo natvrdo „Novy doklad" a typ nebolo vidiet nikde okrem
                rozbalovacky — preto vsetky doklady posobili rovnako. */}
            <h1 className="font-heading text-[clamp(24px,3.2vw,34px)] leading-tight tracking-tight">
              {doc ? "Upraviť " : "Nový "}
              {DOCUMENT_TYPE_LABELS[docType].toLowerCase()}
            </h1>
            {doc?.number ? (
              <p className="text-muted-foreground text-sm">{doc.number}</p>
            ) : null}
          </div>
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
                  <div className="flex gap-2">
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Vyber kontakt">
                            {(v: string) =>
                              contactList.find((c) => c.id === v)?.name ?? ""
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contactList.length === 0 ? (
                          <div className="text-muted-foreground p-2 text-sm">
                            Žiadne kontakty
                          </div>
                        ) : (
                          contactList.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {/* Novy odberatel bez odchodu z rozrobeneho dokladu.
                        Doteraz musel pouzivatel odist do /app/contacts, cim
                        prisiel o vsetko, co mal vyplnene. */}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Nový odberateľ"
                      onClick={() => setNewContactOpen(true)}
                    >
                      <UserPlus className="size-4" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Nový odberateľ sa dá pridať rovno tu — údaje si potiahne
                    z registra podľa IČO.
                  </p>
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
            {products.length > 0 ? (
              <datalist id={PRODUCT_LIST_ID}>
                {products.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            ) : null}
            <div
              className={`text-muted-foreground hidden gap-2 px-1 text-xs font-medium sm:grid ${
                presentation.showPrices
                  ? "grid-cols-[1fr_70px_60px_90px_80px_70px_100px_32px]"
                  : "grid-cols-[1fr_70px_60px_32px]"
              }`}
            >
              <span>Popis</span>
              <span>Množ.</span>
              <span>MJ</span>
              {presentation.showPrices ? (
                <>
                  <span>Cena/j.</span>
                  <span>DPH</span>
                  <span>Zľava%</span>
                  <span className="text-right">Spolu</span>
                </>
              ) : null}
              <span />
            </div>
            {fields.map((f, idx) => {
              const line = totals.lines[idx]
              return (
                <div key={f.id} className="grid gap-2">
                <div
                  className={`grid grid-cols-2 gap-2 sm:items-center ${
                    presentation.showPrices
                      ? "sm:grid-cols-[1fr_70px_60px_90px_80px_70px_100px_32px]"
                      : "sm:grid-cols-[1fr_70px_60px_32px]"
                  }`}
                >
                  {/* Nasepkavac z cennika. Natívny `datalist` zamerne:
                      filtrovanie robi prehliadac, funguje aj bez JS a nepotrebuje
                      dalsiu UI kniznicu. Vyber polozky doplni aj MJ, cenu a DPH. */}
                  <Input
                    placeholder="Popis položky"
                    className="col-span-2 sm:col-span-1"
                    list={products.length > 0 ? PRODUCT_LIST_ID : undefined}
                    {...form.register(`items.${idx}.description`, {
                      onChange: (e) => applyProductByName(idx, e.target.value),
                    })}
                  />
                  <Input
                    type="number"
                    step="0.001"
                    {...form.register(`items.${idx}.quantity`)}
                  />
                  <Input {...form.register(`items.${idx}.unit`)} />
                  {/* Dodaci list sa tlaci bez cien, tak ich ani needitujeme —
                      inak vyzera jeho editor presne ako editor faktury.
                      Polia zostavaju vo formulari (registrovane vyssie), takze
                      prepnutim typu spat sa hodnoty nestratia. */}
                  {presentation.showPrices ? (
                    <>
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
                    </>
                  ) : null}
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

                {/* Uctovne clenenie tejto polozky. Zabalene, aby riadok
                    ostal citatelny — vacsina dokladov ho nepotrebuje po
                    riadkoch a vyplni ho hromadne vyssie. */}
                <details className="text-sm">
                  <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-xs select-none">
                    Účtovné členenie položky
                    {itemAccountingSummary(watchedItems?.[idx])}
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    {ACCOUNTING_FIELDS.map((af) => (
                      <div key={af.name} className="grid gap-1">
                        <Label
                          htmlFor={`item-${idx}-${af.name}`}
                          className="text-muted-foreground text-xs"
                        >
                          {af.label}
                        </Label>
                        <Input
                          id={`item-${idx}-${af.name}`}
                          placeholder={accountingPlaceholder(af.name)}
                          {...form.register(`items.${idx}.${af.name}`)}
                        />
                      </div>
                    ))}
                  </div>
                </details>
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
              {/* Dodaci list rekapitulaciu DPH nema — `presentation` to vie
                  a doteraz sa jej nikto nespytal. */}
              {presentation.showVatRecap ? (
                <>
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
                </>
              ) : null}
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
                <span>
                  {presentation.totalLabelKey === "toPay"
                    ? "Spolu na úhradu"
                    : "Spolu"}
                </span>
                <span className="tabular-nums">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Uctovne clenenie — hromadne vyplnenie */}
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-1">
              <Label>Účtovné členenie</Label>
              <p className="text-muted-foreground text-xs">
                Voliteľné, vstupuje do položkového exportu pre účtovníka.
                Členenie sedí na <strong>položke</strong> — tu ho vyplníš raz
                a tlačidlom prepíšeš do všetkých. Jednotlivé riadky sa dajú
                zmeniť nižšie pri položkách.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              {ACCOUNTING_FIELDS.map((f) => (
                <div key={f.name} className="grid gap-2">
                  <Label htmlFor={`bulk-${f.name}`} className="text-xs">
                    {f.label}
                  </Label>
                  <Input
                    id={`bulk-${f.name}`}
                    value={bulkAccounting[f.name]}
                    onChange={(e) =>
                      setBulkAccounting((prev) => ({
                        ...prev,
                        [f.name]: e.target.value,
                      }))
                    }
                    placeholder={accountingPlaceholder(f.name)}
                  />
                </div>
              ))}
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyAccountingToAll}
              >
                Použiť na všetky položky
              </Button>
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

      <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nový odberateľ</DialogTitle>
            <DialogDescription>
              Zadaj IČO a načítaj údaje z registra, alebo vyplň ručne.
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            onDone={(created) => {
              setNewContactOpen(false)
              if (!created) return
              // Novy kontakt pribudne do zoznamu a rovno sa vyberie. Zoznam
              // sa drzi zoradeny podla mena ako zo servera.
              setContactList((prev) =>
                [...prev, { id: created.id, name: created.name } as Contact].sort(
                  (a, b) => a.name.localeCompare(b.name, "sk"),
                ),
              )
              form.setValue("contactId", created.id, { shouldDirty: true })
            }}
          />
        </DialogContent>
      </Dialog>
    </Form>
  )
}
