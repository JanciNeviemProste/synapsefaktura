-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 2 money operations
-- expenses, bank_transactions, recurring_invoices, reminders, audit_log + a
-- private Storage bucket for attachments. See §5.6/§6.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid');

create type public.expense_source as enum (
  'manual', 'ai_capture', 'peppol_inbound', 'invoice_by_square'
);

create type public.bank_match_status as enum ('unmatched', 'matched', 'ignored');

create type public.recurring_cadence as enum ('weekly', 'monthly', 'custom');

create type public.recurring_send_method as enum ('email', 'peppol', 'none');

create type public.reminder_channel as enum ('email', 'sms');

-- ── expenses (náklady) ───────────────────────────────────────────────────────
create table public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  supplier_contact_id uuid references public.contacts (id) on delete set null,
  document_number     text,
  issue_date          date,
  supply_date         date,
  due_date            date,
  currency            text not null default 'EUR',
  subtotal            numeric(14, 2) not null default 0,
  vat_total           numeric(14, 2) not null default 0,
  total               numeric(14, 2) not null default 0,
  paid_amount         numeric(14, 2) not null default 0,
  status              public.payment_status not null default 'unpaid',
  vat_rate_breakdown  jsonb not null default '[]'::jsonb,
  category            text,
  tax_deductible      boolean not null default true,
  attachment_url      text,
  source              public.expense_source not null default 'manual',
  extraction_id       uuid,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index expenses_org_idx on public.expenses (organization_id);
create index expenses_supplier_idx on public.expenses (supplier_contact_id);
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ── bank_transactions ────────────────────────────────────────────────────────
create table public.bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id      uuid references public.bank_accounts (id) on delete set null,
  amount          numeric(14, 2) not null,
  currency        text not null default 'EUR',
  vs              text,
  ks              text,
  ss              text,
  counterparty    text,
  message         text,
  booked_at       date,
  raw             jsonb,
  matched_status  public.bank_match_status not null default 'unmatched',
  created_at      timestamptz not null default now()
);
create index bank_transactions_org_idx on public.bank_transactions (organization_id);
create index bank_transactions_vs_idx on public.bank_transactions (organization_id, vs);

-- Deferred FK from Phase 1: link a payment to the bank transaction that settled it.
alter table public.payments
  add constraint payments_bank_transaction_fk
  foreign key (bank_transaction_id)
  references public.bank_transactions (id) on delete set null;

-- ── recurring_invoices (pravidelné faktúry) ──────────────────────────────────
create table public.recurring_invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null default '',
  contact_id      uuid references public.contacts (id) on delete set null,
  template        jsonb not null,            -- a document payload (header + items)
  cadence         public.recurring_cadence not null default 'monthly',
  interval_days   int,                       -- for cadence = 'custom'
  next_run_at     date not null,
  last_run_at     date,
  active          boolean not null default true,
  send_method     public.recurring_send_method not null default 'none',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index recurring_invoices_org_idx on public.recurring_invoices (organization_id);
create index recurring_invoices_due_idx
  on public.recurring_invoices (next_run_at)
  where active;
create trigger recurring_invoices_set_updated_at
  before update on public.recurring_invoices
  for each row execute function public.set_updated_at();

-- ── reminders (upomienky) ────────────────────────────────────────────────────
create table public.reminders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id     uuid not null references public.documents (id) on delete cascade,
  level           int not null default 1,
  channel         public.reminder_channel not null default 'email',
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  tone            text,
  body            text,
  ai_generated    boolean not null default false,
  created_at      timestamptz not null default now()
);
create index reminders_org_idx on public.reminders (organization_id);
create index reminders_document_idx on public.reminders (document_id);

-- ── audit_log ────────────────────────────────────────────────────────────────
create table public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  action          text not null,
  entity          text not null,
  entity_id       uuid,
  diff            jsonb,
  at              timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.expenses            enable row level security;
alter table public.bank_transactions   enable row level security;
alter table public.recurring_invoices  enable row level security;
alter table public.reminders           enable row level security;
alter table public.audit_log           enable row level security;

create policy "expenses_all_member" on public.expenses
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "bank_transactions_all_member" on public.bank_transactions
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "recurring_invoices_all_member" on public.recurring_invoices
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "reminders_all_member" on public.reminders
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
-- audit_log: members can read; writes happen via service role / SECURITY DEFINER.
create policy "audit_log_select_member" on public.audit_log
  for select using (public.is_org_member(organization_id));

-- NOTE: the private 'attachments' Storage bucket is created via the Storage API
-- in seed.sql (creating it through SQL here can deadlock against the running
-- storage container). Uploads go through a server action using the service role,
-- which validates org membership before writing under "{organization_id}/…".
