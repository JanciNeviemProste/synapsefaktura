-- =============================================================================
--  Náhrada Supabase prostredia, aby sa migrácie dali overiť na holom PostgreSQL.
--
--  Z celého Supabase používajú migrácie len tri veci:
--    auth.uid()                      · auth.users
--    roly authenticated / anon / service_role
--  Žiadne storage, realtime, vault ani extensions. Stačí teda tento stub
--  a CI nepotrebuje Docker ani Supabase CLI — len `postgres:17` service.
--
--  POZOR: toto NIE JE náhrada Supabase. Overuje sa tým syntax, cudzie kľúče,
--  typy, enumy, triggery a to, či sa politiky vytvoria. NEOVERUJE sa tým, či
--  RLS reálne pustí správneho používateľa k správnym riadkom — na to je
--  `supabase/tests/rls.sql` a `pnpm db:test` proti skutočnému Supabase.
-- =============================================================================

create schema if not exists auth;

-- Supabase roly. Migrácie na ne robia GRANT.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

-- Zjednodušená auth.users. Skutočná má oveľa viac stĺpcov, ale migrácie sa
-- odkazujú len na `id` (cez `references auth.users (id)`).
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- V Supabase číta auth.uid() ID prihláseného používateľa z JWT. Tu sa číta
-- z nastavenia session, aby sa dalo prepínať:
--   select set_config('request.jwt.claim.sub', '<uuid>', true);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Testovací používateľ, aby mal handle_new_user() a spol. na čom bežať.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'test@example.com')
on conflict (id) do nothing;
