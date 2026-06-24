"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/database.types"
import { productSchema, type ProductValues } from "@/lib/validation/product"
import { CURRENT_VAT_RATES, vatRateLabel } from "@/lib/vat/rates"
import { createProduct, updateProduct } from "@/app/actions/products"

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

type Product = Database["public"]["Tables"]["products"]["Row"]

export function ProductForm({
  product,
  onDone,
}: {
  product?: Product | null
  onDone: () => void
}) {
  const [submitting, startSubmit] = useTransition()

  const form = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      unit: product?.unit ?? "ks",
      unitPrice: product?.unit_price ?? 0,
      vatRate: product?.vat_rate ?? 23,
      currency: product?.currency ?? "EUR",
      stockQty: product?.stock_qty ?? undefined,
    },
  })

  function onSubmit(values: ProductValues) {
    startSubmit(async () => {
      const res = product
        ? await updateProduct(product.id, values)
        : await createProduct(values)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(product ? "Položka upravená." : "Položka vytvorená.")
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
                <Input placeholder="Napr. Programovanie (hod.)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU / kód</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jednotka</FormLabel>
                <FormControl>
                  <Input placeholder="ks / hod / kg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="unitPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cena / j.</FormLabel>
                <FormControl>
                  <Input type="number" step="0.0001" min={0} {...field} />
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
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
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
        </div>
        <FormField
          control={form.control}
          name="stockQty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sklad (voliteľné)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.001"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Zrušiť
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {product ? "Uložiť" : "Vytvoriť"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
