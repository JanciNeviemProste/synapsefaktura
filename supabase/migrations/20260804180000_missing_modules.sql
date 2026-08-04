-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — Phase 3 missing modules
-- contact_persons, tags + taggings, stock_movements, cash_registers +
-- cash_register_items, expense_items, expense_payments, and the accounting
-- breakdown (account_code / cost_center / project_code / activity_code) on
-- document_items and expense_items.
-- Why: SuperFaktura parity gaps — several contacts per client, tagging across
-- documents/expenses/contacts, stock history behind products.stock_qty, a cash
-- register, expense lines and expense payments (payments is document-only), and
-- the per-line accounting detail an accounting export needs.
-- Money: unit_price/unit_cost numeric(14,4); amounts numeric(14,2); quantities
-- numeric(14,3) — same as Phase 1.
-- Idempotent (`if not exists` / guarded `do` blocks / drop-before-create) so the
-- file can be re-applied without erroring.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'taggable_type') then
    create type public.taggable_type as enum ('document', 'expense', 'contact');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'stock_movement_type') then
    create type public.stock_movement_type as enum (
      'in',          -- prijem
      'out',         -- vydaj
      'adjustment',  -- oprava stavu (inventura)
      'return'       -- vratka
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cash_flow_direction') then
    create type public.cash_flow_direction as enum (
      'in',   -- prijmovy pokladnicny doklad
      'out'   -- vydavkovy pokladnicny doklad
    );
  end if;
end $$;

-- ── contact_persons (kontaktne osoby) ────────────────────────────────────────
-- `contacts` ma len jeden email a telefon, co pri firme s viacerymi ludmi
-- (nakup, uctovnictvo, prevadzka) nestaci.
create table if not exists public.contact_persons (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id      uuid not null references public.contacts (id) on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  position        text,                              -- funkcia
  is_primary      boolean not null default false,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists contact_persons_org_idx
  on public.contact_persons (organization_id);
create index if not exists contact_persons_contact_idx
  on public.contact_persons (contact_id);
-- najviac jedna hlavna kontaktna osoba na klienta
create unique index if not exists contact_persons_one_primary_idx
  on public.contact_persons (contact_id)
  where is_primary;
drop trigger if exists contact_persons_set_updated_at on public.contact_persons;
create trigger contact_persons_set_updated_at
  before update on public.contact_persons
  for each row execute function public.set_updated_at();

-- ── tags / taggings (stitky) ─────────────────────────────────────────────────
-- Stitok sa da priradit dokladu, nakladu aj klientovi.
create table if not exists public.tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  color           text,                              -- hex, napr. #3b82f6
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists tags_org_idx on public.tags (organization_id);

-- Polymorfna vazba. Alternativou by boli tri samostatne vazobne tabulky;
-- toto je kompaktnejsie a rozsiritelne o dalsie typy.
create table if not exists public.taggings (
  id            uuid primary key default gen_random_uuid(),
  tag_id        uuid not null references public.tags (id) on delete cascade,
  taggable_type public.taggable_type not null,
  taggable_id   uuid not null,
  created_at    timestamptz not null default now(),
  unique (tag_id, taggable_type, taggable_id)
);
create index if not exists taggings_target_idx
  on public.taggings (taggable_type, taggable_id);

-- ── stock_movements (skladove pohyby) ────────────────────────────────────────
-- `products.stock_qty` drzi len aktualny stav, nie historiu. Bez nej sa neda
-- dohladat, ako stav vznikol, ani spatne opravit chybu.
create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  type            public.stock_movement_type not null,
  quantity        numeric(14, 3) not null,           -- vzdy kladne, smer urcuje `type`
  unit_cost       numeric(14, 4),                    -- obstaravacia cena
  -- vazba na doklad, ktory pohyb sposobil
  document_id     uuid references public.documents (id) on delete set null,
  expense_id      uuid references public.expenses (id) on delete set null,
  note            text,
  moved_at        timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),

  constraint stock_movements_qty_positive check (quantity > 0)
);
create index if not exists stock_movements_org_idx
  on public.stock_movements (organization_id);
create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id, moved_at desc);

comment on table public.stock_movements is
  'Historia skladovych pohybov. products.stock_qty ma byt dopocitatelny sucet '
  'tychto zaznamov - inak sa nezhoda neda odhalit.';

-- ── cash_registers / cash_register_items (pokladna) ──────────────────────────
create table if not exists public.cash_registers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  description     text,
  currency        text not null default 'EUR',
  -- samostatne ciselne rady pre prijmove a vydavkove doklady
  sequence_in_id  uuid references public.number_sequences (id),
  sequence_out_id uuid references public.number_sequences (id),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists cash_registers_org_idx
  on public.cash_registers (organization_id);
drop trigger if exists cash_registers_set_updated_at on public.cash_registers;
create trigger cash_registers_set_updated_at
  before update on public.cash_registers
  for each row execute function public.set_updated_at();

create table if not exists public.cash_register_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  cash_register_id uuid not null references public.cash_registers (id) on delete cascade,
  direction        public.cash_flow_direction not null,
  number           text,
  issued_on        date not null default current_date,
  amount           numeric(14, 2) not null,
  vat_amount       numeric(14, 2) not null default 0,
  description      text,
  contact_id       uuid references public.contacts (id) on delete set null,
  document_id      uuid references public.documents (id) on delete set null,
  expense_id       uuid references public.expenses (id) on delete set null,
  created_at       timestamptz not null default now(),

  constraint cash_register_items_amount_positive check (amount > 0)
);
create index if not exists cash_register_items_org_idx
  on public.cash_register_items (organization_id);
create index if not exists cash_register_items_register_idx
  on public.cash_register_items (cash_register_id, issued_on desc);

-- ── expense_items / expense_payments (polozky a uhrady nakladov) ─────────────
-- `payments` je viazana vylucne na `documents`, takze uhrady nakladov sa
-- nemaju kam zapisat.
create table if not exists public.expense_items (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.expenses (id) on delete cascade,
  position     int not null default 0,
  description  text not null default '',
  quantity     numeric(14, 3) not null default 1,
  unit         text not null default 'ks',
  unit_price   numeric(14, 4) not null default 0,
  vat_rate     numeric(5, 2) not null default 23,
  line_base    numeric(14, 2) not null default 0,
  line_vat     numeric(14, 2) not null default 0,
  line_total   numeric(14, 2) not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists expense_items_expense_idx
  on public.expense_items (expense_id);

create table if not exists public.expense_payments (
  id                  uuid primary key default gen_random_uuid(),
  expense_id          uuid not null references public.expenses (id) on delete cascade,
  amount              numeric(14, 2) not null,
  paid_at             date not null default current_date,
  method              public.payment_method not null default 'bank',
  note                text,
  -- naparovany bankovy pohyb
  bank_transaction_id uuid references public.bank_transactions (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists expense_payments_expense_idx
  on public.expense_payments (expense_id);

-- ── Uctovne clenenie poloziek ────────────────────────────────────────────────
-- Potrebne pri exporte do uctovnictva (Pohoda, Omega...).
alter table public.document_items
  add column if not exists account_code  text,   -- ucet
  add column if not exists cost_center   text,   -- stredisko
  add column if not exists project_code  text,   -- zakazka
  add column if not exists activity_code text;   -- cinnost

alter table public.expense_items
  add column if not exists account_code  text,
  add column if not exists cost_center   text,
  add column if not exists project_code  text,
  add column if not exists activity_code text;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.contact_persons     enable row level security;
alter table public.tags                enable row level security;
alter table public.taggings            enable row level security;
alter table public.stock_movements     enable row level security;
alter table public.cash_registers      enable row level security;
alter table public.cash_register_items enable row level security;
alter table public.expense_items       enable row level security;
alter table public.expense_payments    enable row level security;

-- Direct-membership tables. Read/write for any member, delete for owner/admin —
-- these carry accounting history (sklad, pokladna), so removal is privileged.
drop policy if exists "contact_persons_select_member" on public.contact_persons;
create policy "contact_persons_select_member" on public.contact_persons
  for select using (public.is_org_member(organization_id));
drop policy if exists "contact_persons_insert_member" on public.contact_persons;
create policy "contact_persons_insert_member" on public.contact_persons
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "contact_persons_update_member" on public.contact_persons;
create policy "contact_persons_update_member" on public.contact_persons
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "contact_persons_delete_admin" on public.contact_persons;
create policy "contact_persons_delete_admin" on public.contact_persons
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "tags_select_member" on public.tags;
create policy "tags_select_member" on public.tags
  for select using (public.is_org_member(organization_id));
drop policy if exists "tags_insert_member" on public.tags;
create policy "tags_insert_member" on public.tags
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "tags_update_member" on public.tags;
create policy "tags_update_member" on public.tags
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "tags_delete_admin" on public.tags;
create policy "tags_delete_admin" on public.tags
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "stock_movements_select_member" on public.stock_movements;
create policy "stock_movements_select_member" on public.stock_movements
  for select using (public.is_org_member(organization_id));
drop policy if exists "stock_movements_insert_member" on public.stock_movements;
create policy "stock_movements_insert_member" on public.stock_movements
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "stock_movements_update_member" on public.stock_movements;
create policy "stock_movements_update_member" on public.stock_movements
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "stock_movements_delete_admin" on public.stock_movements;
create policy "stock_movements_delete_admin" on public.stock_movements
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "cash_registers_select_member" on public.cash_registers;
create policy "cash_registers_select_member" on public.cash_registers
  for select using (public.is_org_member(organization_id));
drop policy if exists "cash_registers_insert_member" on public.cash_registers;
create policy "cash_registers_insert_member" on public.cash_registers
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "cash_registers_update_member" on public.cash_registers;
create policy "cash_registers_update_member" on public.cash_registers
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "cash_registers_delete_admin" on public.cash_registers;
create policy "cash_registers_delete_admin" on public.cash_registers
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "cash_register_items_select_member" on public.cash_register_items;
create policy "cash_register_items_select_member" on public.cash_register_items
  for select using (public.is_org_member(organization_id));
drop policy if exists "cash_register_items_insert_member" on public.cash_register_items;
create policy "cash_register_items_insert_member" on public.cash_register_items
  for insert with check (public.is_org_member(organization_id));
drop policy if exists "cash_register_items_update_member" on public.cash_register_items;
create policy "cash_register_items_update_member" on public.cash_register_items
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "cash_register_items_delete_admin" on public.cash_register_items;
create policy "cash_register_items_delete_admin" on public.cash_register_items
  for delete using (public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]));

-- Child tables without their own organization_id inherit access via the parent.
drop policy if exists "taggings_via_tag" on public.taggings;
create policy "taggings_via_tag" on public.taggings
  for all using (
    exists (
      select 1 from public.tags t
      where t.id = tag_id and public.is_org_member(t.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.tags t
      where t.id = tag_id and public.is_org_member(t.organization_id)
    )
  );

drop policy if exists "expense_items_via_expense" on public.expense_items;
create policy "expense_items_via_expense" on public.expense_items
  for all using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_org_member(e.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_org_member(e.organization_id)
    )
  );

drop policy if exists "expense_payments_via_expense" on public.expense_payments;
create policy "expense_payments_via_expense" on public.expense_payments
  for all using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_org_member(e.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_org_member(e.organization_id)
    )
  );
