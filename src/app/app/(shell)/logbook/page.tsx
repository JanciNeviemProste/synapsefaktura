import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  VehiclesView,
  type VehicleTripStats,
} from "@/components/logbook/vehicles-view"

export const metadata = { title: "Kniha jázd — Synapse Faktúra" }

export default async function LogbookPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez aktivnej organizacie nemame co zobrazit — prazdny stav.
  if (!orgId) return <VehiclesView vehicles={[]} />

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  // Najazdene km sa scitavaju z jaziek, nie z tachometra — tachometer ukazuje
  // aj km najazdene pred zavedenim knihy jazd.
  const { data: trips } = await supabase
    .from("trips")
    .select("vehicle_id, distance_km")
    .eq("organization_id", orgId)

  const tripStats: VehicleTripStats = {}
  for (const t of trips ?? []) {
    const stats = (tripStats[t.vehicle_id] ??= { km: 0, trips: 0 })
    stats.km += t.distance_km ?? 0
    stats.trips += 1
  }

  return <VehiclesView vehicles={vehicles ?? []} tripStats={tripStats} />
}
