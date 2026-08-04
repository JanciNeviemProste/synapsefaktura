import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  deductibleBusinessFuel,
  travelReimbursement,
} from "@/lib/logbook/consumption"
import { resolveTravelRate } from "@/lib/logbook/rates"
import { listTravelRates } from "@/app/actions/travel-rates"
import { formatMoney } from "@/lib/money"
import {
  FUEL_TYPE_LABELS,
  VEHICLE_OWNERSHIP_LABELS,
  type FuelType,
  type VehicleOwnership,
} from "@/lib/validation/vehicle"
import { TripsView } from "@/components/logbook/trips-view"
import { RefuelingsView } from "@/components/logbook/refuelings-view"
import { VehicleEventsView } from "@/components/logbook/vehicle-events-view"
import { LogbookSummary } from "@/components/logbook/logbook-summary"
import { RecurringTripsView } from "@/components/logbook/recurring-trips-view"
import { listRecurringTrips } from "@/app/actions/recurring-trips"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata = { title: "Kniha jázd — Synapse Faktúra" }

/** Kolko nakladovych dokladov ponukame na naviazanie. */
const EXPENSE_OPTIONS_LIMIT = 200

function formatKm(value: number | null): string {
  if (value === null) return "—"
  return `${new Intl.NumberFormat("sk-SK", {
    maximumFractionDigits: 1,
  }).format(value)} km`
}

function formatLitres(value: number): string {
  return `${new Intl.NumberFormat("sk-SK", {
    maximumFractionDigits: 2,
  }).format(value)} l`
}

export default async function VehicleLogbookPage({
  params,
  searchParams,
}: {
  params: Promise<{ vehicleId: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  // V Next 15 su `params` aj `searchParams` promise — bez awaitu by sme citali
  // `undefined`.
  const { vehicleId } = await params
  const sp = await searchParams

  // Kniha jazd sa vykazuje za obdobie, nie za celu historiu vozidla. Bez
  // obmedzenia by karta uznatelneho paliva scitala vsetky jazdy od zaciatku,
  // kym kontrola pod nou by hlasila nalezy len za obdobie — dve rozne cisla
  // na jednej obrazovke. Preto ma cela stranka jedno spolocne obdobie.
  const now = new Date()
  const periodFrom = sp.from ?? `${now.getFullYear()}-01-01`
  const periodTo = sp.to ?? now.toISOString().slice(0, 10)

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) notFound()

  // Kazdy dotaz je org-scoped. Samotna RLS nestaci — pusti vsetky organizacie,
  // ktorych je pouzivatel clenom, takze clen dvoch firiem by cez podvrhnute id
  // videl vozidlo tej druhej.
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (!vehicle) notFound()

  const [
    { data: trips },
    { data: refuelings },
    { data: events },
    { data: contacts },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("trips")
      .select("*")
      .eq("organization_id", orgId)
      .eq("vehicle_id", vehicleId)
      .gte("trip_date", periodFrom)
      .lte("trip_date", periodTo)
      .order("trip_date", { ascending: false }),
    supabase
      .from("refuelings")
      .select("*")
      .eq("organization_id", orgId)
      .eq("vehicle_id", vehicleId)
      .gte("refueled_at", periodFrom)
      .lte("refueled_at", periodTo)
      .order("refueled_at", { ascending: false }),
    // Udalosti (STK, servis, poistka) sa ZAMERNE neorezavaju obdobim — ich
    // zmyslom je upozornit na to, co prave prichadza alebo preslo.
    supabase
      .from("vehicle_events")
      .select("*")
      .eq("organization_id", orgId)
      .eq("vehicle_id", vehicleId)
      .order("event_date", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("expenses")
      .select("id, document_number, total, currency")
      .eq("organization_id", orgId)
      .order("issue_date", { ascending: false })
      .limit(EXPENSE_OPTIONS_LIMIT),
  ])

  const tripRows = trips ?? []
  const refuelingRows = refuelings ?? []

  // Normovana spotreba musi ratat VSETKY jazdy — auto spali palivo aj na
  // sukromnej ceste a z jednej nadrze sa jazdi oboje. Az uznatelny PODIEL sa
  // urci pomerom sluzobnych kilometrov.
  //
  // Podat sem sluzobne km spolu s celym nakupenym palivom by strop z nakupenej
  // strany umelo nadvihlo a odpocet by vysiel nadhodnoteny — pri 1000 km
  // sluzobne + 1000 sukromne a 70 doloziek litroch by to dalo 60 l namiesto 35.
  const totalKm = tripRows.reduce((sum, t) => sum + t.distance_km, 0)
  const businessKm = tripRows
    .filter((t) => t.purpose === "business")
    .reduce((sum, t) => sum + t.distance_km, 0)
  const purchasedLitres = refuelingRows.reduce((sum, r) => sum + r.litres, 0)

  // Pri kontrole sa uzna len to NIZSIE z dvojice (normovana spotreba, realne
  // nakupene palivo) — preto ukazujeme obidve strany, nie jedno cislo.
  const fuel = deductibleBusinessFuel({
    totalKm,
    businessKm,
    consumption: vehicle.consumption_l_100km,
    purchasedLitres,
  })

  // Nahrada za km sa berie sadzbou platnou ku KONCU obdobia. Presnejsie by
  // bolo ratat kazdu jazdu jej vlastnou sadzbou; to ma zmysel az vtedy, ked
  // sa obdobie tiahne cez zmenu sadzby, a vtedy to tu aj priznavame.
  const [travelRates, recurringTrips] = await Promise.all([
    listTravelRates(),
    listRecurringTrips(vehicleId),
  ])
  const rate = resolveTravelRate(travelRates, periodTo)
  const rateAtStart = resolveTravelRate(travelRates, periodFrom)
  const rateChangedInPeriod =
    rate !== null && rateAtStart !== null && rate.rate_per_km !== rateAtStart.rate_per_km

  const reimbursement = rate
    ? travelReimbursement({ km: businessKm, ratePerKm: rate.rate_per_km })
    : null

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="grid gap-2">
        <Link
          href="/app/logbook"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Vozidlá
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{vehicle.name}</h1>
              <Badge variant="outline">{vehicle.license_plate}</Badge>
              {vehicle.active ? null : (
                <Badge variant="secondary">Neaktívne</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {FUEL_TYPE_LABELS[vehicle.fuel_type as FuelType]} ·{" "}
              {VEHICLE_OWNERSHIP_LABELS[vehicle.ownership as VehicleOwnership]}
              {vehicle.driver_name ? ` · ${vehicle.driver_name}` : ""} · stav{" "}
              {formatKm(vehicle.odometer_km)}
            </p>
          </div>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Od</span>
          <input
            type="date"
            name="from"
            defaultValue={periodFrom}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Do</span>
          <input
            type="date"
            name="to"
            defaultValue={periodTo}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <Button type="submit" variant="outline" size="sm">
          Použiť obdobie
        </Button>
        <p className="text-muted-foreground w-full text-xs">
          Jazdy aj tankovania nižšie sú za zvolené obdobie. Udalosti vozidla sa
          zobrazujú vždy všetky.
        </p>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daňovo uznateľné palivo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {fuel === null ? (
            <p className="text-muted-foreground text-sm">
              Bez kombinovanej spotreby z technického preukazu sa normovaná
              spotreba nedá vypočítať — doplň ju v údajoch vozidla.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Normovaná spotreba"
                  value={formatLitres(fuel.normedLitres)}
                  note={`${formatKm(fuel.totalKm)} spolu × ${
                    vehicle.consumption_l_100km ?? 0
                  } l/100 km`}
                />
                <Field
                  label="Nakúpené palivo"
                  value={formatLitres(fuel.purchasedLitres)}
                  note={`${refuelingRows.length} tankovaní`}
                />
                <Field
                  label="Uznateľné služobne"
                  value={formatLitres(fuel.litres)}
                  note={`${formatKm(fuel.businessKm)} z ${formatKm(
                    fuel.totalKm,
                  )} služobne`}
                />
              </div>
              <p className="text-muted-foreground text-sm">
                Strop je to nižšie z dvojice — {formatLitres(fuel.eligibleLitres)}
                {fuel.basis === "equal"
                  ? " (obe strany sedia)"
                  : fuel.basis === "normed"
                    ? " podľa normovanej spotreby"
                    : " podľa doložených dokladov o palive"}
                . Z toho sa uplatní služobný podiel{" "}
                {Math.round(fuel.businessShare * 100)} %, teda{" "}
                {formatLitres(fuel.litres)}.
              </p>
              <p className="text-muted-foreground text-sm">
                Normovaná spotreba ráta všetky jazdy — auto spáli palivo aj
                súkromne a z jednej nádrže sa jazdí oboje. Služobný podiel sa
                preto určuje pomerom kilometrov, nie výberom tankovaní.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Náhrada za služobné km</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {reimbursement === null || rate === null ? (
            <p className="text-muted-foreground text-sm">
              Zatiaľ nie je zadaná žiadna sadzba cestovnej náhrady platná
              k {periodTo}. Doplň ju v{" "}
              <Link href="/app/settings" className="underline underline-offset-4">
                nastaveniach
              </Link>
              . Sadzbu zámerne nedopĺňame za teba — je to zákonné číslo, ktoré
              sa mení v čase.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Služobné kilometre"
                  value={formatKm(fuel?.businessKm ?? businessKm)}
                  note={`z ${formatKm(totalKm)} spolu`}
                />
                <Field
                  label="Sadzba za km"
                  value={formatMoney(rate.rate_per_km, rate.currency)}
                  note={
                    rate.organization_id
                      ? "vlastná sadzba firmy"
                      : "zákonná sadzba"
                  }
                />
                <Field
                  label="Náhrada spolu"
                  value={formatMoney(reimbursement.total, rate.currency)}
                  note={`platná od ${rate.valid_from}`}
                />
              </div>
              {rateChangedInPeriod ? (
                <p className="text-muted-foreground text-sm">
                  Pozor: sadzba sa počas zvoleného obdobia menila. Celá náhrada
                  je tu spočítaná sadzbou platnou k {periodTo}. Ak potrebuješ
                  presné čísla, rozdeľ obdobie podľa dátumu zmeny.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <LogbookSummary
        vehicleId={vehicle.id}
        periodFrom={periodFrom}
        periodTo={periodTo}
      />

      <TripsView
        vehicleId={vehicle.id}
        trips={tripRows}
        contacts={contacts ?? []}
      />

      <Separator />

      <RecurringTripsView
        vehicleId={vehicle.id}
        recurringTrips={recurringTrips}
        contacts={contacts ?? []}
      />

      <Separator />

      <RefuelingsView
        vehicleId={vehicle.id}
        refuelings={refuelingRows}
        expenses={expenses ?? []}
      />

      <Separator />

      <VehicleEventsView
        vehicleId={vehicle.id}
        events={events ?? []}
        expenses={expenses ?? []}
      />
    </div>
  )
}

function Field({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{note}</span>
    </div>
  )
}
