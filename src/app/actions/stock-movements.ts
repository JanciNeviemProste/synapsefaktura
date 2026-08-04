"use server"

import { revalidatePath } from "next/cache"

import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { stockBalance } from "@/lib/stock/balance"
import {
  stockMovementSchema,
  type StockMovementInput,
} from "@/lib/validation/stock-movement"

export type StockMovementRow =
  Database["public"]["Tables"]["stock_movements"]["Row"]

export type StockMovementActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Historia pohybov jednej polozky, najnovsie prve (poradie pre vypis; vypocet
 * stavu si zoznam triedi sam). Bez organizacie alebo pri chybe vracia prazdno —
 * citanie sa nema na com zlomit.
 */
export async function listStockMovements(
  productId: string,
): Promise<StockMovementRow[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const { data } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("organization_id", orgId)
    .eq("product_id", productId)
    .order("moved_at", { ascending: false })
    .order("created_at", { ascending: false })

  return data ?? []
}

/**
 * Prepocita `products.stock_qty` zo VSETKYCH pohybov polozky a zapise ho.
 *
 * `stock_qty` je denormalizovana hodnota — zdrojom pravdy su `stock_movements`.
 * Preto sa nikdy neinkrementuje, vzdy sa rata odznova: inkrement by pri chybe
 * alebo suboznom zapise ticho ulozil nezmysel, ktory by uz nikto neodhalil.
 */
async function recalcProductStock(
  supabase: Supabase,
  orgId: string,
  productId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("type, quantity, moved_at, created_at")
    .eq("organization_id", orgId)
    .eq("product_id", productId)
  if (error || !data) return

  await supabase
    .from("products")
    .update({ stock_qty: stockBalance(data) })
    .eq("id", productId)
    .eq("organization_id", orgId)
}

/**
 * Polozka mohla mat stav zapisany rucne v cenniku este pred prvym pohybom.
 * Prepocet zo samotnych pohybov by ho zmazal, tak ho pri prvom pohybe zapiseme
 * ako pociatocny stav (inventura k datumu vzniku polozky). Historia potom
 * vysvetluje kazdy kus na sklade a `stock_qty` ostava dopocitatelna.
 */
async function ensureOpeningMovement(
  supabase: Supabase,
  orgId: string,
  product: { id: string; stock_qty: number | null; created_at: string },
  userId: string | null,
): Promise<boolean> {
  if (product.stock_qty === null || product.stock_qty <= 0) return true

  const { count, error } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("product_id", product.id)
  if (error) return false
  if ((count ?? 0) > 0) return true

  const { error: insertError } = await supabase.from("stock_movements").insert({
    organization_id: orgId,
    product_id: product.id,
    type: "adjustment",
    quantity: product.stock_qty,
    moved_at: product.created_at,
    note: "Počiatočný stav zadaný v cenníku",
    created_by: userId,
  })
  return !insertError
}

/**
 * Zapise skladovy pohyb a prepocita stav polozky. Mnozstvo je vzdy kladne,
 * smer urcuje typ (`in` / `return` pridavaju, `out` uberá, `adjustment` je
 * zisteny skutocny stav pri inventure).
 */
export async function createStockMovement(
  input: StockMovementInput,
): Promise<StockMovementActionResult> {
  const parsed = stockMovementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // Polozka musi patrit tejto organizacii. Samotna RLS nestaci — pusti vsetky
  // organizacie, ktorych je pouzivatel clenom.
  const { data: product } = await supabase
    .from("products")
    .select("id, stock_qty, created_at")
    .eq("id", v.productId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!product) return { ok: false, error: "Položka sa nenašla." }

  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id ?? null

  if (!(await ensureOpeningMovement(supabase, orgId, product, userId))) {
    return { ok: false, error: "Pohyb sa nepodarilo uložiť." }
  }

  const { data: created, error } = await supabase
    .from("stock_movements")
    .insert({
      organization_id: orgId,
      product_id: v.productId,
      type: v.type,
      quantity: v.quantity,
      unit_cost: v.unitCost ?? null,
      note: v.note ?? null,
      moved_at: new Date(v.movedAt ?? Date.now()).toISOString(),
      created_by: userId,
    })
    .select("id")
    .single()
  if (error || !created) {
    return { ok: false, error: "Pohyb sa nepodarilo uložiť." }
  }

  // Pohyb je zapisany, teda ulozeny je aj zdroj pravdy. Ak zlyha samotny
  // prepocet, akcia preto neskonci chybou — `stock_qty` dobehne pri dalsom
  // pohybe, kedy sa rata znova z celej historie.
  await recalcProductStock(supabase, orgId, v.productId)

  revalidatePath("/app/products")
  return { ok: true, id: created.id }
}
