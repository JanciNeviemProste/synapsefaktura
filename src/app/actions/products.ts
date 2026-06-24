"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { productSchema, type ProductInput } from "@/lib/validation/product"

export type ProductActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function toRow(v: ReturnType<typeof productSchema.parse>) {
  return {
    name: v.name,
    sku: v.sku ?? null,
    unit: v.unit,
    unit_price: v.unitPrice,
    vat_rate: v.vatRate,
    currency: v.currency,
    stock_qty: v.stockQty ?? null,
  }
}

export async function createProduct(
  input: ProductInput,
): Promise<ProductActionResult> {
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("products")
    .insert({ organization_id: orgId, ...toRow(parsed.data) })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Položku sa nepodarilo uložiť." }
  revalidatePath("/app/products")
  return { ok: true, id: data.id }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ProductActionResult> {
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("products")
    .update(toRow(parsed.data))
    .eq("id", id)
  if (error) return { ok: false, error: "Položku sa nepodarilo uložiť." }
  revalidatePath("/app/products")
  return { ok: true, id }
}

export async function deleteProduct(id: string): Promise<ProductActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) return { ok: false, error: "Položku sa nepodarilo zmazať." }
  revalidatePath("/app/products")
  return { ok: true, id }
}
