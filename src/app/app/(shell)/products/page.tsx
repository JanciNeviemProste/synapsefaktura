import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { ProductsView } from "@/components/products/products-view"

export const metadata = { title: "Cenník — Synapse Faktúra" }

export default async function ProductsPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez aktivnej organizacie nemame co zobrazit — prazdny stav.
  if (!orgId) return <ProductsView products={[]} />

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  return <ProductsView products={products ?? []} />
}
