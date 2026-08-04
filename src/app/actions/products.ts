"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { productSchema, type ProductInput } from "@/lib/validation/product"

export type ProductActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/**
 * Riadok cennika BEZ `stock_qty`.
 *
 * Stav skladu urcuju vylucne `stock_movements` a dopocitava ho
 * `recalcProductStock`. Kym ho zapisoval aj tento formular, mali sme dvoch
 * nezavislych zapisovatelov: pouzivatel prepisal stav na 100, cennik ukazal
 * 100, panel pohybov 6, a najblizsi pohyb 100 ticho prepisal spat — bez
 * pohybu, ktory by to vysvetlil, takze sa uz nedalo zistit, ktora hodnota
 * platila.
 */
function toRow(v: ReturnType<typeof productSchema.parse>) {
  return {
    name: v.name,
    sku: v.sku ?? null,
    unit: v.unit,
    unit_price: v.unitPrice,
    vat_rate: v.vatRate,
    currency: v.currency,
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
    .insert({
      organization_id: orgId,
      ...toRow(parsed.data),
      // Pri zalozeni polozka este pohyby nema, takze zadany stav je POCIATOCNY.
      // Pri prvom pohybe ho `ensureOpeningMovement` prepise na zaznam typu
      // `adjustment`, takze historia ostane uplna.
      stock_qty: parsed.data.stockQty ?? null,
    })
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
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // `.eq("organization_id")` aj `.select()`: RLS pusti VSETKY organizacie,
  // ktorych je pouzivatel clenom, takze bez filtra sa dala prepisat polozka
  // cudzej firmy. A bez `.select()` vrati PostgREST pri nulovom pocte
  // zasiahnutych riadkov 204 bez chyby — akcia by hlasila uspech.
  const { data, error } = await supabase
    .from("products")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
  if (error) return { ok: false, error: "Položku sa nepodarilo uložiť." }
  if (!data || data.length === 0) {
    return { ok: false, error: "Položka sa nenašla." }
  }
  revalidatePath("/app/products")
  return { ok: true, id }
}

export async function deleteProduct(id: string): Promise<ProductActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
  if (error) return { ok: false, error: "Položku sa nepodarilo zmazať." }
  if (!data || data.length === 0) {
    return { ok: false, error: "Položka sa nenašla." }
  }
  revalidatePath("/app/products")
  return { ok: true, id }
}
