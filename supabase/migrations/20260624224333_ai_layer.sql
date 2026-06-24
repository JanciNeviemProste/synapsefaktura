-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 3 AI layer
-- ai_extractions, ai_messages, ai_usage, forecasts (§6). All org-scoped + RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ai_extractions (document capture, §7.1) ──────────────────────────────────
create table public.ai_extractions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_file_url text,
  model           text,
  raw_response    jsonb,
  parsed          jsonb,
  confidence      numeric(5, 2),
  status          text not null default 'pending', -- pending|parsed|confirmed|failed
  created_at      timestamptz not null default now()
);
create index ai_extractions_org_idx on public.ai_extractions (organization_id);

-- ── ai_messages (assistant chat history, §7.3) ───────────────────────────────
create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  thread_id       uuid not null default gen_random_uuid(),
  role            text not null,           -- user|assistant|tool
  content         text,
  tool_calls      jsonb,
  created_at      timestamptz not null default now()
);
create index ai_messages_org_idx on public.ai_messages (organization_id);
create index ai_messages_thread_idx on public.ai_messages (thread_id, created_at);

-- ── ai_usage (per-org token/cost logging, §4/§7) ─────────────────────────────
create table public.ai_usage (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature         text not null,           -- capture|nl_invoice|assistant|compliance|forecast|reminder|anomaly
  model           text,
  input_tokens    int not null default 0,
  output_tokens   int not null default 0,
  cost            numeric(12, 6) not null default 0,
  created_at      timestamptz not null default now()
);
create index ai_usage_org_idx on public.ai_usage (organization_id, created_at desc);

-- ── forecasts (cash-flow, §7.5) ──────────────────────────────────────────────
create table public.forecasts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  horizon_days    int not null default 30,
  generated_at    timestamptz not null default now(),
  data            jsonb,
  narrative       text
);
create index forecasts_org_idx on public.forecasts (organization_id, generated_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.ai_extractions enable row level security;
alter table public.ai_messages    enable row level security;
alter table public.ai_usage       enable row level security;
alter table public.forecasts      enable row level security;

create policy "ai_extractions_all_member" on public.ai_extractions
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "ai_messages_all_member" on public.ai_messages
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "forecasts_all_member" on public.forecasts
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- ai_usage: members read; writes happen via service role (system jobs) or members.
create policy "ai_usage_select_member" on public.ai_usage
  for select using (public.is_org_member(organization_id));
create policy "ai_usage_insert_member" on public.ai_usage
  for insert with check (public.is_org_member(organization_id));
