-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 0 foundation
-- Tables: profiles, organizations, organization_members, bank_accounts, vat_rates
-- Multi-tenant via organization_id + RLS. See SYNAPSE_FAKTURA_MASTER_PROMPT.md §6.
-- Reversal: `supabase db reset` re-applies from scratch; to roll back manually drop
-- the objects in reverse dependency order.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.org_role as enum ('owner', 'admin', 'accountant', 'member');

-- VAT modes the system must support (§5.2).
create type public.vat_mode as enum (
  'payer',                    -- platiteľ DPH (full VAT)
  'non_payer',                -- neplatiteľ DPH ("Nie som platiteľ DPH.")
  'reverse_charge_domestic',  -- prenesenie daňovej povinnosti (§69)
  'intra_eu_b2b',             -- intra-EU B2B
  'oss',                      -- One-Stop-Shop
  'export',                   -- export mimo EÚ
  'exempt'                    -- oslobodené plnenia
);

-- ── Shared helpers ───────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles (1:1 with auth.users) ───────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale       text not null default 'sk',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row automatically on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── organizations ────────────────────────────────────────────────────────────
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  legal_form    text,
  ico           text,
  dic           text,
  ic_dph        text,
  is_vat_payer  boolean not null default false,
  vat_mode_default public.vat_mode not null default 'non_payer',
  -- Address
  street        text,
  city          text,
  postal_code   text,
  country       text not null default 'SK',
  -- Branding
  logo_url      text,
  signature_url text,
  stamp_url     text,
  -- Defaults
  default_currency text not null default 'EUR',
  default_language text not null default 'sk',
  default_due_days int not null default 14,
  -- E-invoice / Peppol (2027 readiness — captured now, used in Phase 4)
  peppol_id     text,
  einvoice_enabled boolean not null default false,
  digital_postman_provider text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ── organization_members ─────────────────────────────────────────────────────
create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'member',
  invited_at      timestamptz,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members (user_id);

-- Membership lookup as SECURITY DEFINER to avoid RLS recursion when other
-- tables' policies reference organization_members.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.org_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.role = any(roles)
  );
$$;

-- ── bank_accounts ────────────────────────────────────────────────────────────
create table public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  iban            text not null,
  swift           text,
  bank_name       text,
  currency        text not null default 'EUR',
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index bank_accounts_org_idx on public.bank_accounts (organization_id);

create trigger bank_accounts_set_updated_at
  before update on public.bank_accounts
  for each row execute function public.set_updated_at();

-- ── vat_rates (global codebook, not tenant-scoped) ───────────────────────────
-- Effective-from/to so historical documents keep their original rate (§5.1).
-- Do NOT hardcode 0.23 in app code — read selectable rates from here by date.
create table public.vat_rates (
  code          text primary key,
  percent       numeric(5, 2) not null,
  valid_from    date not null,
  valid_to      date,           -- null = still active
  category_note text
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.bank_accounts        enable row level security;
alter table public.vat_rates            enable row level security;

-- profiles: a user sees and edits only their own row.
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- organizations: members can read; any authenticated user can create an org;
-- owners/admins can update; owners can delete.
create policy "organizations_select_member" on public.organizations
  for select using (public.is_org_member(id));
create policy "organizations_insert_authenticated" on public.organizations
  for insert with check ((select auth.uid()) is not null);
create policy "organizations_update_admin" on public.organizations
  for update using (public.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.org_role[]));
create policy "organizations_delete_owner" on public.organizations
  for delete using (public.has_org_role(id, array['owner']::public.org_role[]));

-- organization_members: members can read the roster; a user may add themselves
-- (used when creating an org), and owners/admins may manage members.
create policy "members_select" on public.organization_members
  for select using (public.is_org_member(organization_id));
create policy "members_insert_self_or_admin" on public.organization_members
  for insert with check (
    user_id = (select auth.uid())
    or public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[])
  );
create policy "members_update_admin" on public.organization_members
  for update using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));
create policy "members_delete_admin" on public.organization_members
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

-- bank_accounts: scoped to org membership.
create policy "bank_accounts_select_member" on public.bank_accounts
  for select using (public.is_org_member(organization_id));
create policy "bank_accounts_insert_member" on public.bank_accounts
  for insert with check (public.is_org_member(organization_id));
create policy "bank_accounts_update_member" on public.bank_accounts
  for update using (public.is_org_member(organization_id));
create policy "bank_accounts_delete_member" on public.bank_accounts
  for delete using (public.is_org_member(organization_id));

-- vat_rates: readable by any authenticated user; writes are service-role only
-- (no write policy → only the service role, which bypasses RLS, can write).
create policy "vat_rates_select_authenticated" on public.vat_rates
  for select using ((select auth.uid()) is not null);

-- ── Onboarding RPC ───────────────────────────────────────────────────────────
-- Atomically create an organization, add the caller as owner, and optionally
-- a default bank account. SECURITY DEFINER so all three inserts happen in one
-- transaction without RLS ordering issues; the caller is bound to auth.uid().
create or replace function public.create_organization_with_owner(
  p_name              text,
  p_legal_form        text default null,
  p_ico               text default null,
  p_dic               text default null,
  p_ic_dph            text default null,
  p_is_vat_payer      boolean default false,
  p_vat_mode_default  public.vat_mode default 'non_payer',
  p_street            text default null,
  p_city              text default null,
  p_postal_code       text default null,
  p_country           text default 'SK',
  p_default_currency  text default 'EUR',
  p_default_language  text default 'sk',
  p_default_due_days  int default 14,
  p_iban              text default null,
  p_swift             text default null,
  p_bank_name         text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org public.organizations;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (
    name, legal_form, ico, dic, ic_dph, is_vat_payer, vat_mode_default,
    street, city, postal_code, country,
    default_currency, default_language, default_due_days
  ) values (
    p_name, p_legal_form, p_ico, p_dic, p_ic_dph, p_is_vat_payer, p_vat_mode_default,
    p_street, p_city, p_postal_code, p_country,
    p_default_currency, p_default_language, p_default_due_days
  )
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, v_uid, 'owner');

  if p_iban is not null and length(trim(p_iban)) > 0 then
    insert into public.bank_accounts (organization_id, iban, swift, bank_name, currency, is_default)
    values (v_org.id, p_iban, p_swift, p_bank_name, p_default_currency, true);
  end if;

  return v_org;
end;
$$;
