"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import {
  contactSchema,
  CONTACT_TYPE_LABELS,
  type ContactValues,
} from "@/lib/validation/contact"
import { createContact, updateContact } from "@/app/actions/contacts"
import { searchCompanyByIco, validateIcDph } from "@/app/actions/registry"

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

type Contact = Database["public"]["Tables"]["contacts"]["Row"]

export function ContactForm({
  contact,
  onDone,
}: {
  contact?: Contact | null
  /**
   * `created` je id NOVO vytvoreneho kontaktu; pri uprave je `undefined`.
   * Vdaka tomu vie volajuci (napr. editor dokladu) novy kontakt hned vybrat
   * bez toho, aby musel odist zo stranky a nacitat zoznam odznova.
   */
  onDone: (created?: { id: string; name: string }) => void
}) {
  const [submitting, startSubmit] = useTransition()
  const [looking, startLookup] = useTransition()
  const [checking, startCheck] = useTransition()

  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      type: (contact?.type as ContactValues["type"]) ?? "customer",
      name: contact?.name ?? "",
      ico: contact?.ico ?? "",
      dic: contact?.dic ?? "",
      icDph: contact?.ic_dph ?? "",
      street: contact?.street ?? "",
      city: contact?.city ?? "",
      postalCode: contact?.postal_code ?? "",
      country: contact?.country ?? "SK",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      defaultDueDays: contact?.default_due_days ?? undefined,
      notes: contact?.notes ?? "",
    },
  })

  function handleIcoLookup() {
    const ico = form.getValues("ico")?.trim()
    if (!ico) return toast.error("Najprv zadaj IČO.")
    startLookup(async () => {
      const res = await searchCompanyByIco(ico)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const c = res.data
      form.setValue("name", c.name, { shouldValidate: true })
      if (c.dic) form.setValue("dic", c.dic)
      if (c.icDph) form.setValue("icDph", c.icDph)
      if (c.street) form.setValue("street", c.street)
      if (c.city) form.setValue("city", c.city)
      if (c.postalCode) form.setValue("postalCode", c.postalCode)
      form.setValue("country", c.country)
      toast.success("Údaje načítané z registra.")
    })
  }

  function handleViesCheck() {
    const icDph = form.getValues("icDph")?.trim()
    if (!icDph) return toast.error("Zadaj IČ DPH.")
    startCheck(async () => {
      const res = await validateIcDph(icDph)
      if (res.status === "valid")
        toast.success(`IČ DPH je platné${res.name ? ` — ${res.name}` : ""}.`)
      else if (res.status === "invalid") toast.error("IČ DPH je neplatné.")
      else toast.warning("VIES je nedostupný, skús neskôr.")
    })
  }

  function onSubmit(values: ContactValues) {
    startSubmit(async () => {
      const res = contact
        ? await updateContact(contact.id, values)
        : await createContact(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(contact ? "Kontakt upravený." : "Kontakt vytvorený.")
      onDone(contact ? undefined : { id: res.id, name: values.name })
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Názov / meno</FormLabel>
                <FormControl>
                  <Input placeholder="Firma s.r.o. / Ján Novák" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: keyof typeof CONTACT_TYPE_LABELS) =>
                          CONTACT_TYPE_LABELS[v]
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(CONTACT_TYPE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="ico"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IČO</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input placeholder="12345678" {...field} />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleIcoLookup}
                    disabled={looking}
                    title="Načítať z registra"
                  >
                    {looking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DIČ</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="icDph"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IČ DPH</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input placeholder="SK…" {...field} />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleViesCheck}
                    disabled={checking}
                    title="Overiť v VIES"
                  >
                    {checking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="street"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ulica a číslo</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PSČ</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mesto</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Krajina</FormLabel>
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefón</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="defaultDueDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Splatnosť (dni)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={365}
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Poznámka</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onDone()}>
            Zrušiť
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {contact ? "Uložiť" : "Vytvoriť"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
