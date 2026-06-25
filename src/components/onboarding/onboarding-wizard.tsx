"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { FieldPath } from "react-hook-form"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import {
  createOrganizationSchema,
  VAT_MODE_LABELS,
  type CreateOrganizationValues,
  type VatMode,
} from "@/lib/validation/org"
import { searchCompanyByIco } from "@/app/actions/registry"
import { createOrganization } from "@/app/actions/org"

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

type FieldName = FieldPath<CreateOrganizationValues>

const STEPS: { titleKey: string; descKey: string; fields: FieldName[] }[] = [
  {
    titleKey: "stepCompany",
    descKey: "stepCompanyDesc",
    fields: ["name"],
  },
  { titleKey: "stepAddress", descKey: "stepAddressDesc", fields: [] },
  { titleKey: "stepVat", descKey: "stepVatDesc", fields: [] },
  {
    titleKey: "stepBank",
    descKey: "stepBankDesc",
    fields: [],
  },
]

export function OnboardingWizard() {
  const t = useTranslations("onboarding")
  const [step, setStep] = useState(0)
  const [submitting, startSubmit] = useTransition()
  const [looking, startLookup] = useTransition()

  const form = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      legalForm: "",
      ico: "",
      dic: "",
      icDph: "",
      isVatPayer: false,
      vatModeDefault: "non_payer",
      street: "",
      city: "",
      postalCode: "",
      country: "SK",
      defaultCurrency: "EUR",
      defaultLanguage: "sk",
      defaultDueDays: 14,
      iban: "",
      swift: "",
      bankName: "",
    },
  })

  const isLast = step === STEPS.length - 1

  function handleIcoLookup() {
    const ico = form.getValues("ico")?.trim()
    if (!ico) {
      toast.error("Najprv zadaj IČO.")
      return
    }
    startLookup(async () => {
      const result = await searchCompanyByIco(ico)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const c = result.data
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
      toast.success("Údaje firmy načítané z registra.")
    })
  }

  async function next() {
    const fields = STEPS[step].fields
    const valid = fields.length === 0 ? true : await form.trigger(fields)
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function onSubmit(values: CreateOrganizationValues) {
    startSubmit(async () => {
      const result = await createOrganization(values)
      if (result?.error) toast.error(result.error)
      // On success the action redirects to the dashboard.
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {t("step", { current: step + 1, total: STEPS.length })}
        </CardDescription>
        <CardTitle>{t(STEPS[step].titleKey)}</CardTitle>
        <CardDescription>{t(STEPS[step].descKey)}</CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="grid gap-4">
            {step === 0 && (
              <>
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
                          onClick={handleIcoLookup}
                          disabled={looking}
                        >
                          {looking ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Search className="size-4" />
                          )}
                          Načítať
                        </Button>
                      </div>
                      <FormDescription>
                        Načíta názov a adresu z registra (RPO).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <div className="grid gap-4 sm:grid-cols-2">
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
              </>
            )}

            {step === 1 && (
              <>
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
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
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
              </>
            )}

            {step === 2 && (
              <>
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
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatModeDefault"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Predvolený režim DPH</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
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
              </>
            )}

            {step === 3 && (
              <>
                <FormField
                  control={form.control}
                  name="iban"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IBAN</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SK00 0000 0000 0000 0000 0000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="swift"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SWIFT / BIC</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banka</FormLabel>
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
                    name="defaultCurrency"
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
                  <FormField
                    control={form.control}
                    name="defaultLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jazyk</FormLabel>
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
                          <Input type="number" min={0} max={365} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0 || submitting}
            >
              {t("back")}
            </Button>
            {isLast ? (
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("creating")}
                  </>
                ) : (
                  t("finish")
                )}
              </Button>
            ) : (
              <Button type="button" onClick={next}>
                {t("next")}
              </Button>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
