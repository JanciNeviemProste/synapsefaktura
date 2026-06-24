import { createClient } from "@/lib/supabase/server"
import { ProductsView } from "@/components/products/products-view"

export const metadata = { title: "Cenník — Synapse Faktúra" }

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })

  return <ProductsView products={products ?? []} />
}
