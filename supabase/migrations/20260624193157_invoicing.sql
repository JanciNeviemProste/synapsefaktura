-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 1 invoicing core
-- contacts, products, number_sequences, documents, document_items, payments.
-- Money: unit_price numeric(14,4); amounts numeric(14,2). VAT engine computes in
-- the app (cent-based) and persists the resulting values here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.contact_type as enum ('customer', 'supplier', 'both');

create type public.document_type as enum (
  'invoice',          -- faktúra
  'proforma',         -- proforma / zálohová
  'advance',          -- preddavková (daňový doklad k preddavku)
  'tax_doc_payment',  -- daňový doklad k prijatej platbe
  'credit_note',      -- dobropis
  'quote',            -- cenová ponuka
  'order_issued',     -- vystavená objednávka
  'order_received',   -- prijatá objednávka
  'delivery_note',    -- dodací list
  'draft'             -- koncept
);

create type public.document_status as enum (
  'draft', 'issued', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'
);

create type public.payment_method as enum ('bank', 'card', 'cash', 'other');

-- ── contacts ─────────────────────────────────────────────────────────────────
create table public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  type               public.contact_type not null default 'customer',
  name               text not null,
  ico                text,
  dic                text,
  ic_dph             text,
  street             text,
  city               text,
  postal_code        text,
  country            text not null default 'SK',
  email              text,
  phone              text,
  default_due_days   int,
  peppol_id          text,
  payment_behavior_score numeric(5, 2),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index contacts_org_idx on public.contacts (organization_id);
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ── products / cenník ────────────────────────────────────────────────────────
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  sku              text,
  unit             text not null default 'ks',
  unit_price       numeric(14, 4) not null default 0,
  vat_rate         numeric(5, 2) not null default 23,
  currency         text not null default 'EUR',
  stock_qty        numeric(14, 3),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index products_org_idx on public.products (organization_id);
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ── number_sequences ─────────────────────────────────────────────────────────
-- Per org/type/year. `format` supports tokens {prefix} {year} {seq}.
create table public.number_sequences (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  doc_type         public.document_type not null,
  year             int not null,
  prefix           text not null default '',
  format           text not null default '{year}{seq}',
  next_number      int not null default 1,
  padding          int not null default 4,
  created_at       timestamptz not null default now(),
  unique (organization_id, doc_type, year)
);
create index number_sequences_org_idx on public.number_sequences (organization_id);

-- ── documents (unified) ──────────────────────────────────────────────────────
create table public.documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  type                public.document_type not null,
  number              text,
  sequence_id         uuid references public.number_sequences (id),
  contact_id          uuid references public.contacts (id),
  issue_date          date,
  supply_date         date,                 -- DUZP / dátum dodania
  due_date            date,
  currency            text not null default 'EUR',
  exchange_rate       numeric(14, 6) not null default 1,
  language            text not null default 'sk',
  vat_mode            public.vat_mode not null default 'payer',
  status              public.document_status not null default 'draft',
  subtotal            numeric(14, 2) not null default 0,
  vat_total           numeric(14, 2) not null default 0,
  total               numeric(14, 2) not null default 0,
  paid_amount         numeric(14, 2) not null default 0,
  notes               text,
  footer_notes        text,
  legal_notes         text,
  related_document_id uuid references public.documents (id),
  pdf_url             text,
  source              text not null default 'manual', -- manual|ai_nl|recurring|api|import
  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index documents_org_idx on public.documents (organization_id);
create index documents_contact_idx on public.documents (contact_id);
create index documents_status_idx on public.documents (organization_id, status);
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ── document_items ───────────────────────────────────────────────────────────
create table public.document_items (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents (id) on delete cascade,
  position      int not null default 0,
  description   text not null default '',
  quantity      numeric(14, 3) not null default 1,
  unit          text not null default 'ks',
  unit_price    numeric(14, 4) not null default 0,
  vat_rate      numeric(5, 2) not null default 23,  -- historical rate, persisted per line
  discount_pct  numeric(5, 2) not null default 0,
  line_base     numeric(14, 2) not null default 0,
  line_vat      numeric(14, 2) not null default 0,
  line_total    numeric(14, 2) not null default 0,
  product_id    uuid references public.products (id),
  created_at    timestamptz not null default now()
);
create index document_items_doc_idx on public.document_items (document_id);

-- ── payments ─────────────────────────────────────────────────────────────────
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references public.documents (id) on delete cascade,
  amount              numeric(14, 2) not null,
  paid_at             date not null default current_date,
  method              public.payment_method not null default 'bank',
  bank_transaction_id uuid,   -- FK added in Phase 2 (bank_transactions)
  created_at          timestamptz not null default now()
);
create index payments_doc_idx on public.payments (document_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.contacts         enable row level security;
alter table public.products         enable row level security;
alter table public.number_sequences enable row level security;
alter table public.documents        enable row level security;
alter table public.document_items   enable row level security;
alter table public.payments         enable row level security;

-- Direct-membership tables.
create policy "contacts_all_member" on public.contacts
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "products_all_member" on public.products
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "number_sequences_all_member" on public.number_sequences
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "documents_all_member" on public.documents
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Child tables scoped through their parent document.
create policy "document_items_all_member" on public.document_items
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_org_member(d.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_org_member(d.organization_id)
    )
  );
create policy "payments_all_member" on public.payments
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_org_member(d.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_org_member(d.organization_id)
    )
  );

-- ── Atomic document numbering ────────────────────────────────────────────────
-- Reserves the next number for (org, doc_type, year), creating the sequence on
-- first use, and returns the formatted number. SECURITY DEFINER + row lock so
-- concurrent issues never collide or skip.
create or replace function public.next_document_number(
  p_org uuid,
  p_doc_type public.document_type,
  p_year int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq    public.number_sequences;
  v_num    int;
  v_result text;
begin
  if not public.is_org_member(p_org) then
    raise exception 'Not a member of this organization';
  end if;

  insert into public.number_sequences (organization_id, doc_type, year)
  values (p_org, p_doc_type, p_year)
  on conflict (organization_id, doc_type, year) do nothing;

  select * into v_seq
  from public.number_sequences
  where organization_id = p_org and doc_type = p_doc_type and year = p_year
  for update;

  v_num := v_seq.next_number;

  update public.number_sequences
  set next_number = next_number + 1
  where id = v_seq.id;

  v_result := v_seq.format;
  v_result := replace(v_result, '{prefix}', coalesce(v_seq.prefix, ''));
  v_result := replace(v_result, '{year}', p_year::text);
  v_result := replace(v_result, '{seq}', lpad(v_num::text, v_seq.padding, '0'));
  return v_result;
end;
$$;
