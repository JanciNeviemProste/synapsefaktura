-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 5: billing + multi-user invites
-- organizations gains plan/Stripe columns; new org_invites table. §8/§8.1.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Plan tier ────────────────────────────────────────────────────────────────
create type public.plan_tier as enum ('free', 'pro', 'business');

alter table public.organizations
  add column plan                 public.plan_tier not null default 'free',
  add column stripe_customer_id   text,
  add column stripe_subscription_id text,
  add column subscription_status  text,            -- mirrors Stripe sub status
  add column current_period_end   timestamptz;

-- ── org_invites ──────────────────────────────────────────────────────────────
-- An invite is a shareable token (works without email delivery, which is still
-- stubbed). The accept path runs under the service role (the invitee is not yet
-- a member, so RLS would otherwise hide the row).
create table public.org_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text,
  role            public.org_role not null default 'member',
  token           text not null unique,
  invited_by      uuid references auth.users (id) on delete set null,
  accepted_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '14 days'),
  created_at      timestamptz not null default now()
);
create index org_invites_org_idx on public.org_invites (organization_id, created_at desc);
create index org_invites_token_idx on public.org_invites (token);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Owners/admins of an org manage its invites. Accepting a token is done via the
-- service role in the server action (the invitee can't see the row pre-membership).
alter table public.org_invites enable row level security;

create policy "org_invites_admin_manage" on public.org_invites
  for all using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));
