-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 4: E-invoice 2027 (Peppol) readiness
-- einvoices (§6): outbound + inbound EN 16931 / Peppol BIS 3.0 (UBL 2.1) messages.
-- Original XML is archived here (§9: e-invoices kept in original XML form).
-- ─────────────────────────────────────────────────────────────────────────────

create type public.einvoice_direction as enum ('outbound', 'inbound');
create type public.einvoice_validation_status as enum ('pending', 'valid', 'invalid');
create type public.einvoice_transport_status as enum ('queued', 'sent', 'delivered', 'failed', 'received');

create table public.einvoices (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  -- outbound: the source invoice; inbound: null until/unless it links to a doc
  document_id        uuid references public.documents (id) on delete set null,
  -- inbound: the expense auto-created from the parsed XML (funnel from §7.1)
  expense_id         uuid references public.expenses (id) on delete set null,
  direction          public.einvoice_direction not null,
  ubl_xml            text,                       -- original archived XML (§9)
  peppol_message_id  text,                       -- AP transport id
  sender_peppol_id   text,                       -- 0245:[DIČ]
  receiver_peppol_id text,
  validation_status  public.einvoice_validation_status not null default 'pending',
  validation_errors  jsonb,                      -- [{rule,severity,message,location}]
  transport_status   public.einvoice_transport_status not null default 'queued',
  provider           text,                       -- digital_postman_provider used
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index einvoices_org_idx on public.einvoices (organization_id, created_at desc);
create index einvoices_document_idx on public.einvoices (document_id);
create index einvoices_direction_idx on public.einvoices (organization_id, direction, transport_status);

create trigger einvoices_set_updated_at
  before update on public.einvoices
  for each row execute function public.set_updated_at ();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Members read/write their org's e-invoices; system jobs (Peppol poll/send) use
-- the service role, which bypasses RLS.
alter table public.einvoices enable row level security;

create policy "einvoices_all_member" on public.einvoices
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
