-- Doklady: platobne symboly, danove atributy, doprava a dodacia adresa.
--
-- PRECO SYMBOLY: `bank_transactions` uz ma `vs`, ale `documents` ziadny
-- variabilny symbol nemal — parovanie preto porovnavalo `digits(tx.vs)` proti
-- `digits(documents.number)`. Funguje to, ale je to implicitny kontrakt: dva
-- ciselne rady, ktore po odstraneni nepismenkovych znakov splynu
-- (FA2026-0001 aj PP2026-0001 -> 20260001), daju nejednoznacnu zhodu.
-- Explicitny stlpec to robi jednoznacnym.
--
-- PRECO DANOVE ATRIBUTY: prenos danovej povinnosti (par. 69 ods. 12 zakona
-- o DPH), datum danovej povinnosti a OSS sa dnes nikam nezapisu, hoci ich
-- doklad musi uniest.
--
-- PRECO show_prices: dodaci list sa bezne tlaci BEZ cien. Zatial to PDF
-- odvodzuje z typu dokladu (lib/documents/presentation.ts); tento stlpec
-- umoznuje prepnut to na urovni konkretneho dokladu.
--
-- Vsetko su ADITIVNE zmeny (add column if not exists) — ziadny existujuci
-- riadok sa nemeni a migracia je opakovatelna.

-- ── 1. Platobne symboly ──────────────────────────────────────────────────────
alter table public.documents
  add column if not exists variable_symbol text,
  add column if not exists constant_symbol text,
  add column if not exists specific_symbol text;

comment on column public.documents.variable_symbol is
  'Variabilny symbol. Parovacie kriterium voci bank_transactions.vs.';

-- Parovanie uhrad chodi cez (organizacia, VS) — bez indexu by to bol seq scan.
create index if not exists documents_vs_idx
  on public.documents (organization_id, variable_symbol)
  where variable_symbol is not null;

-- ── 2. Obchodne udaje ────────────────────────────────────────────────────────
alter table public.documents
  add column if not exists order_number   text,
  add column if not exists internal_notes text,
  add column if not exists header_notes   text,
  add column if not exists discount_pct   numeric(5, 2) not null default 0,
  add column if not exists deposit        numeric(14, 2) not null default 0,
  add column if not exists already_paid   numeric(14, 2) not null default 0;

comment on column public.documents.internal_notes is
  'Interna poznamka — na doklade sa netlaci. Doteraz sa do `notes` mapovali '
  'tri rozne veci naraz (verejna poznamka, hlavicka, interna poznamka).';

-- ── 3. Danove atributy (SK legislativa) ──────────────────────────────────────
alter table public.documents
  add column if not exists vat_transfer    boolean not null default false,
  add column if not exists tax_document    boolean not null default false,
  add column if not exists tax_date        date,
  add column if not exists accounting_date date,
  add column if not exists oss             boolean not null default false;

comment on column public.documents.vat_transfer is
  'Prenos danovej povinnosti (reverse charge) podla par. 69 ods. 12 '
  'zakona c. 222/2004 Z. z.';

-- ── 4. Vystavil ──────────────────────────────────────────────────────────────
-- Na kazdom doklade moze byt iny clovek, preto to nepatri na organizaciu.
alter table public.documents
  add column if not exists issued_by_name  text,
  add column if not exists issued_by_email text,
  add column if not exists issued_by_phone text;

-- ── 5. Zaokruhlovanie ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rounding_mode') then
    create type public.rounding_mode as enum (
      'document',  -- DPH sa zaokruhluje za cely doklad
      'item',      -- DPH sa pocita po polozkach
      'item_ext'   -- maloobchodne zaokruhlenie (odporucane pre e-shopy)
    );
  end if;
end $$;

alter table public.documents
  add column if not exists rounding public.rounding_mode not null default 'item';

-- ── 6. Doprava (pre e-shop a export pre kuriera) ─────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'delivery_method') then
    create type public.delivery_method as enum (
      'courier',      -- kurier
      'mail',         -- postou
      'personal',     -- osobny odber
      'pickup_point', -- odberne miesto
      'haulage'       -- nakladna doprava
    );
  end if;
end $$;

alter table public.documents
  add column if not exists delivery_method public.delivery_method,
  add column if not exists tracking_number text,
  add column if not exists parcel_count    int,
  add column if not exists weight_kg       numeric(10, 3),
  add column if not exists pickup_point_id text;

-- ── 7. Dodacia adresa ────────────────────────────────────────────────────────
-- Odlisna od fakturacnej. Bez nej sa neda vystavit poriadny dodaci list.
alter table public.documents
  add column if not exists delivery_name        text,
  add column if not exists delivery_street      text,
  add column if not exists delivery_city        text,
  add column if not exists delivery_postal_code text,
  add column if not exists delivery_country     text,
  add column if not exists delivery_phone       text;

-- ── 8. Zobrazenie konkretneho dokladu ────────────────────────────────────────
alter table public.documents
  add column if not exists show_qr_payment boolean not null default true,
  add column if not exists show_signature  boolean not null default false,
  add column if not exists show_prices     boolean not null default true,
  add column if not exists bank_account_id uuid references public.bank_accounts (id);

comment on column public.documents.show_prices is
  'Dodacie listy sa bezne vystavuju bez cien — preto nastavenie per doklad, '
  'nie globalne na organizacii.';
