-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 4 kniha jázd (logbook)
-- vehicles, trips, refuelings, recurring_trips, vehicle_events, travel_rates.
-- Why: kniha jázd nie je súčasť SuperFaktúry, ale samostatný produkt
-- SuperCestak (moj.supercestak.sk) s modulmi /cars, /cars/rides, /cars/fueling,
-- /cars/event, /cars/recurring, /cars/dashboard. Štruktúra vychádza z crawlu
-- ostrého účtu (názvy stĺpcov v zoznamoch); presné názvy polí vo formulároch
-- overiť nešlo — SuperCestak je SPA a formuláre v HTML nie sú.
-- Tax: kniha jázd je daňový podklad. Pri kontrole sa porovnáva najazdené km ×
-- normovaná spotreba oproti reálne nakúpenému palivu a uznať sa dá len to
-- NIŽŠIE z dvojice — preto `vehicles.consumption_l_100km` aj `refuelings`.
-- Money: sumy numeric(14,2); sadzby numeric(10,4); km numeric(12,1)/(10,1);
-- spotreba numeric(6,2) — rovnako ako Phase 1.
-- Idempotent (`if not exists` / guarded `do` blocks / drop-before-create) so the
-- file can be re-applied without erroring.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fuel_type') then
    create type public.fuel_type as enum (
      'petrol',    -- benzin
      'diesel',    -- nafta
      'lpg',
      'cng',
      'electric',  -- elektrina
      'hybrid'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_ownership') then
    create type public.vehicle_ownership as enum (
      'company',   -- firemne vozidlo
      'private',   -- sukromne vozidlo (SZCO, zamestnanec, spolocnik, konatel)
      'leased'     -- prenajate / na leasing
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'trip_purpose') then
    create type public.trip_purpose as enum (
      'business',  -- sluzobna jazda
      'private'    -- sukromna jazda (nezaklada narok na odpocet)
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_event_type') then
    create type public.vehicle_event_type as enum (
      'service',     -- servis
      'inspection',  -- STK / EK
      'insurance',   -- poistenie
      'repair',      -- oprava
      'tyres',       -- prezutie
      'fine',        -- pokuta
      'other'
    );
  end if;
end $$;

-- ── vehicles (vozidla) ───────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  name                text not null,                     -- nazov alebo interne oznacenie
  license_plate       text not null,                     -- SPZ
  fuel_type           public.fuel_type not null default 'petrol',
  ownership           public.vehicle_ownership not null default 'company',
  driver_name         text,                              -- predvoleny vodic
  -- "kombinovana spotreba" podla technickeho preukazu; je to zakonny podklad
  -- pre vypocet uznatelnych nakladov na palivo
  consumption_l_100km numeric(6, 2),
  odometer_km         numeric(12, 1) not null default 0,  -- aktualny stav tachometra
  vin                 text,
  note                text,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, license_plate)
);
create index if not exists vehicles_org_idx on public.vehicles (organization_id);
drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

comment on column public.vehicles.consumption_l_100km is
  'Kombinovana spotreba podla technickeho preukazu. Uznatelne naklady na '
  'palivo = min(najazdene km x tato spotreba, skutocne nakupene palivo).';

-- ── trips (jazdy) ────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  vehicle_id        uuid not null references public.vehicles (id) on delete cascade,
  trip_date         date not null,
  origin            text,                              -- odkial
  destination       text,                              -- kam
  -- jazdu je mozne naviazat na klienta a vzdialenost dopocitat
  contact_id        uuid references public.contacts (id) on delete set null,
  distance_km       numeric(10, 1) not null default 0,
  round_trip        boolean not null default true,     -- tam aj spat
  purpose           public.trip_purpose not null default 'business',
  purpose_note      text,                              -- ucel jazdy, slovom
  driver_name       text,
  odometer_start_km numeric(12, 1),
  odometer_end_km   numeric(12, 1),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint trips_distance_nonneg check (distance_km >= 0),
  constraint trips_odometer_order check (
    odometer_start_km is null
    or odometer_end_km is null
    or odometer_end_km >= odometer_start_km
  )
);
create index if not exists trips_org_idx on public.trips (organization_id);
create index if not exists trips_org_date_idx
  on public.trips (organization_id, trip_date desc);
create index if not exists trips_vehicle_idx
  on public.trips (vehicle_id, trip_date desc);
drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ── refuelings (tankovanie) ──────────────────────────────────────────────────
-- Potrebne na porovnanie: uznat sa da len to nizsie z dvojice
-- (normovana spotreba, skutocne nakupene palivo).
create table if not exists public.refuelings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id      uuid not null references public.vehicles (id) on delete cascade,
  refueled_at     date not null,
  litres          numeric(10, 2) not null,
  price_per_litre numeric(10, 4) not null,
  total_price     numeric(14, 2) not null,
  odometer_km     numeric(12, 1),
  -- vazba na doklad o nakupe, ak existuje
  expense_id      uuid references public.expenses (id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint refuelings_positive check (litres > 0 and price_per_litre >= 0)
);
create index if not exists refuelings_org_idx on public.refuelings (organization_id);
create index if not exists refuelings_vehicle_idx
  on public.refuelings (vehicle_id, refueled_at desc);

-- ── recurring_trips (pravidelne jazdy) ───────────────────────────────────────
-- Sablona, z ktorej sa jazdy generuju opakovane. Zamerne kopiruje styl
-- existujucej tabulky recurring_invoices.
create table if not exists public.recurring_trips (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id      uuid not null references public.vehicles (id) on delete cascade,
  cadence         public.recurring_cadence not null default 'monthly',
  origin          text,
  destination     text,
  contact_id      uuid references public.contacts (id) on delete set null,
  distance_km     numeric(10, 1) not null default 0,
  round_trip      boolean not null default true,
  purpose         public.trip_purpose not null default 'business',
  purpose_note    text,
  next_run_on     date,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists recurring_trips_org_idx
  on public.recurring_trips (organization_id);
create index if not exists recurring_trips_due_idx
  on public.recurring_trips (organization_id, next_run_on)
  where active;
drop trigger if exists recurring_trips_set_updated_at on public.recurring_trips;
create trigger recurring_trips_set_updated_at
  before update on public.recurring_trips
  for each row execute function public.set_updated_at();

-- ── vehicle_events (udalosti vozidla) ────────────────────────────────────────
-- Modul /cars/event. V ziadnom verejnom zdroji popisany nie je - objavil sa az
-- crawlom ostreho uctu. Sluzi na evidenciu servisu, STK, poistky a podobnych
-- udalosti so vztahom k vozidlu.
create table if not exists public.vehicle_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id      uuid not null references public.vehicles (id) on delete cascade,
  type            public.vehicle_event_type not null default 'other',
  event_date      date not null default current_date,
  description     text,
  cost            numeric(14, 2),
  odometer_km     numeric(12, 1),
  -- vazba na doklad o nakupe sluzby, ak existuje
  expense_id      uuid references public.expenses (id) on delete set null,
  -- pripomienka pred dalsou udalostou (STK, poistka)
  next_due_on     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists vehicle_events_org_idx
  on public.vehicle_events (organization_id);
create index if not exists vehicle_events_vehicle_idx
  on public.vehicle_events (vehicle_id, event_date desc);
create index if not exists vehicle_events_due_idx
  on public.vehicle_events (organization_id, next_due_on)
  where next_due_on is not null;
drop trigger if exists vehicle_events_set_updated_at on public.vehicle_events;
create trigger vehicle_events_set_updated_at
  before update on public.vehicle_events
  for each row execute function public.set_updated_at();

-- ── travel_rates (sadzby cestovnych nahrad) ──────────────────────────────────
-- Stlpec "Nahrada" v zozname vozidiel je vypocitana hodnota. Aby sa dala
-- vypocitat, treba niekde drzat zakonne sadzby - a tie sa v case menia, takze
-- musia mat platnost od-do, inak by prepocet starych jazd dal ine cislo nez
-- povodne.
create table if not exists public.travel_rates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations (id) on delete cascade,
  valid_from       date not null,
  valid_to         date,
  -- zakladna nahrada za kazdy km
  rate_per_km      numeric(10, 4) not null,
  -- nahrada za palivo sa rata zo spotreby vozidla a ceny paliva,
  -- tu sa drzi len pripadna pausalna sadzba
  fuel_rate_per_km numeric(10, 4),
  currency         text not null default 'EUR',
  note             text,
  created_at       timestamptz not null default now(),

  constraint travel_rates_period check (valid_to is null or valid_to >= valid_from)
);
create index if not exists travel_rates_org_idx
  on public.travel_rates (organization_id);
create index if not exists travel_rates_validity_idx
  on public.travel_rates (organization_id, valid_from desc);

comment on table public.travel_rates is
  'Sadzby cestovnych nahrad s platnostou od-do. organization_id moze byt '
  'NULL - vtedy ide o zakonnu sadzbu platnu pre vsetkych.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.vehicles        enable row level security;
alter table public.trips           enable row level security;
alter table public.refuelings      enable row level security;
alter table public.recurring_trips enable row level security;
alter table public.vehicle_events  enable row level security;
alter table public.travel_rates    enable row level security;

-- Direct-membership tables. Read/write for any member, delete for owner/admin —
-- kniha jazd je danovy podklad, takze mazanie je privilegovana operacia.
drop policy if exists "vehicles_select_member" on public.vehicles;
create policy "vehicles_select_member" on public.vehicles
  for select using (public.is_org_member(organization_id));
drop policy if exists "vehicles_insert_member" on public.vehicles;
create policy "vehicles_insert_member" on public.vehicles
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "vehicles_update_member" on public.vehicles;
create policy "vehicles_update_member" on public.vehicles
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "vehicles_delete_admin" on public.vehicles;
create policy "vehicles_delete_admin" on public.vehicles
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "trips_select_member" on public.trips;
create policy "trips_select_member" on public.trips
  for select using (public.is_org_member(organization_id));
drop policy if exists "trips_insert_member" on public.trips;
create policy "trips_insert_member" on public.trips
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "trips_update_member" on public.trips;
create policy "trips_update_member" on public.trips
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "trips_delete_admin" on public.trips;
create policy "trips_delete_admin" on public.trips
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "refuelings_select_member" on public.refuelings;
create policy "refuelings_select_member" on public.refuelings
  for select using (public.is_org_member(organization_id));
drop policy if exists "refuelings_insert_member" on public.refuelings;
create policy "refuelings_insert_member" on public.refuelings
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "refuelings_update_member" on public.refuelings;
create policy "refuelings_update_member" on public.refuelings
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "refuelings_delete_admin" on public.refuelings;
create policy "refuelings_delete_admin" on public.refuelings
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "recurring_trips_select_member" on public.recurring_trips;
create policy "recurring_trips_select_member" on public.recurring_trips
  for select using (public.is_org_member(organization_id));
drop policy if exists "recurring_trips_insert_member" on public.recurring_trips;
create policy "recurring_trips_insert_member" on public.recurring_trips
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "recurring_trips_update_member" on public.recurring_trips;
create policy "recurring_trips_update_member" on public.recurring_trips
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "recurring_trips_delete_admin" on public.recurring_trips;
create policy "recurring_trips_delete_admin" on public.recurring_trips
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "vehicle_events_select_member" on public.vehicle_events;
create policy "vehicle_events_select_member" on public.vehicle_events
  for select using (public.is_org_member(organization_id));
drop policy if exists "vehicle_events_insert_member" on public.vehicle_events;
create policy "vehicle_events_insert_member" on public.vehicle_events
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "vehicle_events_update_member" on public.vehicle_events;
create policy "vehicle_events_update_member" on public.vehicle_events
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "vehicle_events_delete_admin" on public.vehicle_events;
create policy "vehicle_events_delete_admin" on public.vehicle_events
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

-- travel_rates ma organization_id nullable: NULL = zakonna sadzba platna pre
-- vsetkych. Standardny vzor by taky riadok NIKOMU nezobrazil, lebo
-- is_org_member(NULL) vrati NULL a politika by neprosla. Preto zvlast: select
-- pusti aj `organization_id is null`, zapis nie - zakonnu sadzbu meni len
-- migracia / service role.
drop policy if exists "travel_rates_select" on public.travel_rates;
create policy "travel_rates_select" on public.travel_rates
  for select using (organization_id is null or public.is_org_member(organization_id));
drop policy if exists "travel_rates_insert_member" on public.travel_rates;
create policy "travel_rates_insert_member" on public.travel_rates
  for insert with check (organization_id is not null and public.is_org_member(organization_id));
drop policy if exists "travel_rates_update_member" on public.travel_rates;
create policy "travel_rates_update_member" on public.travel_rates
  for update using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));
drop policy if exists "travel_rates_delete_admin" on public.travel_rates;
create policy "travel_rates_delete_admin" on public.travel_rates
  for delete using (
    organization_id is not null
    and public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[])
  );
