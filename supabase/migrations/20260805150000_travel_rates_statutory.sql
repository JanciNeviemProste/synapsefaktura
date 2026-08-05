-- ─────────────────────────────────────────────────────────────────────────────
--  Synapse Faktúra — zákonné sadzby cestovných náhrad a kategória vozidla
--
--  Tabuľka `travel_rates` bola zavedená v migrácii 20260804190000 a zostala
--  prázdna. Bez sadzby sa náhrada za služobné kilometre nepočíta vôbec.
--
--  PREČO KATEGÓRIA VOZIDLA: zákon rozlišuje osobné cestné motorové vozidlo od
--  jednostopového vozidla, trojkolky a štvorkolky. Rozdiel je 3,5-násobný
--  (0,313 vs 0,090 €/km od 1. 1. 2026), takže jedna sadzba pre všetko by pri
--  motocykli vyrobila náhradu ďaleko nad zákonným stropom. `vehicles` kategóriu
--  nemala, takže sa správna sadzba nedala ani vybrať.
--
--  ZDROJ SADZIEB: Zbierka zákonov SR (static.slov-lex.sk), overené priamo
--  v znení predpisov, nie z druhotných zdrojov. Aktuálna sadzba je navyše
--  potvrdená stránkou Národného inšpektorátu práce aj MPSVR SR.
--
--    od 1. 5. 2024   0,265 / 0,075   opatrenie  73/2024 Z. z.
--    od 1. 3. 2025   0,281 / 0,080   oznámenie  22/2025 Z. z.
--    od 1. 6. 2025   0,296 / 0,085   oznámenie  97/2025 Z. z.
--    od 1. 1. 2026   0,313 / 0,090   oznámenie 340/2025 Z. z.
--    (osobné vozidlá / jednostopové, trojkolky a štvorkolky)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_category') then
    create type public.vehicle_category as enum (
      'passenger',   -- osobné cestné motorové vozidlo
      'motorcycle'   -- jednostopové vozidlo, trojkolka, štvorkolka
    );
  end if;
end $$;

-- Existujúce vozidlá sú autá — iná kategória sa dovtedy nedala ani zadať.
alter table public.vehicles
  add column if not exists category public.vehicle_category not null default 'passenger';

comment on column public.vehicles.category is
  'Rozhoduje o tom, ktorá zákonná sadzba cestovnej náhrady sa na vozidlo '
  'vzťahuje. Zákon má pre jednostopové vozidlá a štvorkolky výrazne nižšiu.';

alter table public.travel_rates
  -- NULL = sadzba platí pre akékoľvek vozidlo. Tak sa zadáva vlastná sadzba
  -- firmy, ktorá medzi kategóriami zvyčajne nerozlišuje.
  add column if not exists vehicle_category public.vehicle_category,
  -- Číslo predpisu, z ktorého sadzba pochádza (napr. '340/2025 Z. z.').
  add column if not exists source_ref  text,
  add column if not exists source_url  text,
  -- Kedy ju našiel cron. NULL pri ručne zadaných.
  add column if not exists detected_at timestamptz,
  -- NULL = navrhnutá, ešte nepotvrdená. `resolveTravelRate` ju ignoruje, takže
  -- sa do potvrdenia počíta starou sadzbou. Sadzba sa nikdy nezmení sama.
  add column if not exists confirmed_at timestamptz;

comment on column public.travel_rates.confirmed_at is
  'NULL = sadzbu našiel cron na stránke ministerstva, ale nikto ju ešte '
  'nepotvrdil — do potvrdenia sa nepoužíva. Daňové číslo sa nemá zmeniť samo.';

create index if not exists travel_rates_pending_idx
  on public.travel_rates (valid_from desc)
  where organization_id is null and confirmed_at is null;

-- ── zákonné sadzby ───────────────────────────────────────────────────────────
-- `organization_id is null` = zákonná sadzba platná pre všetkých.
-- `confirmed_at` je vyplnené: tieto hodnoty som overil v Zbierke zákonov, nie
-- vyparsoval zo stránky, takže potvrdenie používateľom nedáva zmysel.
--
-- `not exists` namiesto `on conflict`: tabuľka nemá unikátny kľúč cez
-- (kategória, platnosť) a nechceme ho tu zavádzať — vlastné sadzby firiem sa
-- legitímne prekrývajú a `resolveTravelRate` si s tým poradí.
insert into public.travel_rates
  (organization_id, vehicle_category, valid_from, valid_to,
   rate_per_km, currency, source_ref, source_url, note, confirmed_at)
select v.*
from (values
  (null::uuid, 'passenger'::public.vehicle_category,
   date '2024-05-01', date '2025-02-28', 0.2650, 'EUR',
   'opatrenie 73/2024 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2024/73/vyhlasene_znenie.html',
   'Zákonná sadzba — osobné cestné motorové vozidlá.', now()),
  (null, 'motorcycle',
   date '2024-05-01', date '2025-02-28', 0.0750, 'EUR',
   'opatrenie 73/2024 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2024/73/vyhlasene_znenie.html',
   'Zákonná sadzba — jednostopové vozidlá a trojkolky.', now()),

  (null, 'passenger',
   date '2025-03-01', date '2025-05-31', 0.2810, 'EUR',
   'oznámenie 22/2025 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2025/22/vyhlasene_znenie.html',
   'Zákonná sadzba — osobné cestné motorové vozidlá.', now()),
  (null, 'motorcycle',
   date '2025-03-01', date '2025-05-31', 0.0800, 'EUR',
   'oznámenie 22/2025 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2025/22/vyhlasene_znenie.html',
   'Zákonná sadzba — dvojkolesové, trojkolesové vozidlá a štvorkolky.', now()),

  (null, 'passenger',
   date '2025-06-01', date '2025-12-31', 0.2960, 'EUR',
   'oznámenie 97/2025 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2025/97/vyhlasene_znenie.html',
   'Zákonná sadzba — osobné cestné motorové vozidlá.', now()),
  (null, 'motorcycle',
   date '2025-06-01', date '2025-12-31', 0.0850, 'EUR',
   'oznámenie 97/2025 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2025/97/vyhlasene_znenie.html',
   'Zákonná sadzba — dvojkolesové, trojkolesové vozidlá a štvorkolky.', now()),

  -- Platná dnes. `valid_to` je NULL — platí, kým ju ministerstvo nezmení.
  (null, 'passenger',
   date '2026-01-01', null, 0.3130, 'EUR',
   'oznámenie 340/2025 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2025/340/vyhlasene_znenie.html',
   'Zákonná sadzba — osobné cestné motorové vozidlá.', now()),
  (null, 'motorcycle',
   date '2026-01-01', null, 0.0900, 'EUR',
   'oznámenie 340/2025 Z. z.',
   'https://static.slov-lex.sk/static/SK/ZZ/2025/340/vyhlasene_znenie.html',
   'Zákonná sadzba — dvojkolesové, trojkolesové vozidlá a štvorkolky.', now())
) as v (organization_id, vehicle_category, valid_from, valid_to,
        rate_per_km, currency, source_ref, source_url, note, confirmed_at)
where not exists (
  select 1 from public.travel_rates t
  where t.organization_id is null
    and t.source_ref = v.source_ref
    and t.vehicle_category = v.vehicle_category
);

comment on table public.travel_rates is
  'Sadzby cestovných náhrad s platnosťou od-do. organization_id NULL = zákonná '
  'sadzba platná pre všetkých; vlastná sadzba firmy má pred ňou prednosť. '
  'Jazda sa počíta sadzbou platnou v ČASE JAZDY, nie dnešnou.';
