-- ─────────────────────────────────────────────────────────────────────────────
--  Synapse Faktúra — príves a kategória „štvorkolka"
--
--  Podľa zákona č. 283/2002 Z. z. o cestovných náhradách sa pri použití prívesu
--  k ŠTVORKOLKE alebo k OSOBNÉMU vozidlu základná náhrada zvýši o 15 %.
--  Pre dvojkolesové a trojkolesové vozidlá to neplatí.
--
--  PREČO TRETIA KATEGÓRIA: pre SADZBU oznámenia štvorkolky zlučujú s motocyklami
--  („dvojkolesové, trojkolesové vozidlá a štvorkolky: 0,090 eura"), ale pre
--  PRÍPLATOK ich zákon rozdeľuje. Dvojhodnotový enum to nevie vyjadriť.
--
--  Sadzby pre `quad` sa ZÁMERNE neseedujú — sú rovnaké ako pri motocykli
--  a `resolveTravelRate` na ne kategóriu mapuje. Dva rovnaké riadky navyše by
--  znamenali dve miesta, ktoré sa dajú rozísť.
--
--  POZOR, OVERENÉ NA POSTGRESE: `alter type … add value` v transakcii prejde,
--  ale POUŽIŤ tú hodnotu v tej istej transakcii Postgres odmietne
--  („unsafe use of new value"). Táto migrácia preto enum len rozširuje a nikde
--  hodnotu `'quad'` nepoužíva. Kto sem bude pridávať `insert`, musí ho dať do
--  samostatnej migrácie.
-- ─────────────────────────────────────────────────────────────────────────────

alter type public.vehicle_category add value if not exists 'quad';

-- Príves sa použije na KONKRÉTNEJ jazde, nie natrvalo na vozidle — to isté
-- auto ide raz s vlekom a inokedy bez neho.
alter table public.trips
  add column if not exists with_trailer boolean not null default false;

alter table public.recurring_trips
  add column if not exists with_trailer boolean not null default false;

comment on column public.trips.with_trailer is
  'Jazda s prívesom — základná náhrada sa zvyšuje o 15 %, ale LEN pri osobnom '
  'vozidle a štvorkolke (zákon č. 283/2002 Z. z.). Pri motocykli sa príznak '
  'ignoruje; príplatok by bol nadhodnotením daňového podkladu.';
