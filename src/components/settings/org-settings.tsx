"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save, Search } from "lucide-react"
import { toast } from "sonner"

import {
  updateOrganizationSchema,
  VAT_MODE_LABELS,
  type UpdateOrganizationValues,
  type VatMode,
} from "@/lib/validation/org"
import { searchCompanyByIco } from "@/app/actions/registry"
import { updateOrganization, type OrganizationProfile } from "@/app/actions/org"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
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

export function OrgSettings({
  initial,
  canManage,
}: {
  initial: OrganizationProfile
  canManage: boolean
}) {
  const router = useRouter()
  const [saving, startSaving] = useTransition()
  const [looking, startLookup] = useTransition()

  const form = useForm<UpdateOrganizationValues>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: initial,
  })

  // Rovnaky vzor ako v contact-form.tsx — dotiahne udaje z RPO podla ICO.
  function handleIcoLookup() {
    const ico = form.getValues("ico")?.trim()
    if (!ico) {
      toast.error("Najprv zadaj IČO.")
      return
    }
    startLookup(async () => {
      const res = await searchCompanyByIco(ico)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const c = res.data
      form.setValue("name", c.name, { shouldValidate: true })
      if (c.legalForm) form.setValue("legalForm", c.legalForm)
      if (c.dic) form.setValue("dic", c.dic)
      if (c.icDph) {
        form.setValue("icDph", c.icDph)
        form.setValue("isVatPayer", true)
      }
      if (c.street) form.setValue("street", c.street)
      if (c.city) form.setValue("city", c.city)
      if (c.postalCode) form.setValue("postalCode", c.postalCode)
      form.setValue("country", c.country)
      toast.success("Údaje načítané z registra.")
    })
  }

  function onSubmit(values: UpdateOrganizationValues) {
    startSaving(async () => {
      const res = await updateOrganization(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Firemné údaje uložené.")
      form.reset(values)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firemné údaje</CardTitle>
        <CardDescription>
          Údaje, ktoré sa tlačia na doklady — dodávateľ, adresa, režim DPH a
          predvolené hodnoty nových faktúr.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
            <fieldset disabled={!canManage} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Názov firmy</FormLabel>
                      <FormControl>
                        <Input placeholder="Moja firma s.r.o." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="legalForm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Právna forma</FormLabel>
                      <FormControl>
                        <Input placeholder="s.r.o. / SZČO …" {...field} />
                      </FormControl>
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
                          title="Načítať z registra (RPO)"
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
                      <FormControl>
                        <Input placeholder="SK…" {...field} />
                      </FormControl>
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
                        <Input placeholder="811 01" {...field} />
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
                        <Input placeholder="SK" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isVatPayer"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="grid gap-1">
                      <FormLabel>Som platiteľ DPH</FormLabel>
                      <FormDescription>
                        Ak nie si platiteľ, na doklady sa tlačí „Nie som
                        platiteľ DPH.“
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!canManage}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="vatModeDefault"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Predvolený režim DPH</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!canManage}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: VatMode) => VAT_MODE_LABELS[value]}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultDueDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Predvolená splatnosť (dni)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={365} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="defaultCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Predvolená mena</FormLabel>
                      <FormControl>
                        <Input placeholder="EUR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Predvolený jazyk dokladov</FormLabel>
                      <FormControl>
                        <Input placeholder="sk" {...field} />
                      </FormControl>
                      <FormDescription>
                        Kód jazyka: sk, cz alebo en.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>
          </CardContent>

          <CardFooter className="justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              {canManage
                ? "Zmeny sa prejavia na nových dokladoch."
                : "Firemné údaje môže meniť len vlastník alebo administrátor."}
            </p>
            <Button type="submit" disabled={saving || !canManage}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Uložiť
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
