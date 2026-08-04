-- Uhrady v cudzich menach.
--
-- PRECO: `documents` uz multimenovost zvlada — ma `currency` aj
-- `exchange_rate`. `payments` ale mala len `amount`, bez meny a bez kurzu.
-- Ked je faktura v USD a klient ju uhradi, nebolo kam zapisat, kolko to bolo
-- v domacej mene.
--
-- Dosledky pred touto migraciou:
--   - `documents.paid_amount` scitaval sumy v roznych menach dokopy
--   - vykazy obratu v domacej mene boli nespravne
--   - kurzovy rozdiel medzi vystavenim a uhradou sa nikde neevidoval,
--     hoci je to uctovne relevantna polozka
--
-- Zdroj: entita InvoicePayment zo ZIVEHO API SuperFaktury. V ich oficialnej
-- API dokumentacii tato entita NIE JE — odhalil ju az dump skutocnych odpovedi.

alter table public.payments
  -- mena, v ktorej uhrada realne prisla
  add column if not exists currency        text not null default 'EUR',
  -- kurz voci domacej mene v DEN UHRADY (nie v den vystavenia)
  add column if not exists exchange_rate   numeric(14, 6) not null default 1,
  -- suma prepocitana na domacu menu; drzi sa ulozena, aby sa historicke
  -- vykazy nemenili pri kazdej zmene kurzu
  add column if not exists amount_home     numeric(14, 2),
  -- kurzovy rozdiel oproti kurzu z dna vystavenia dokladu
  add column if not exists exchange_diff   numeric(14, 2),
  add column if not exists note            text,
  add column if not exists variable_symbol text;

comment on column public.payments.amount_home is
  'Suma v domacej mene organizacie. Dopocita sa raz pri zapise uhrady '
  '(amount * exchange_rate) a dalej sa nemeni — inak by sa spatne menili '
  'uz uzavrete obdobia.';

comment on column public.payments.exchange_diff is
  'Kurzovy rozdiel: rozdiel medzi hodnotou pohladavky pri vystaveni a '
  'skutocne prijatou sumou v domacej mene. Uctovne relevantna polozka.';

-- Dopocet amount_home, ked ho aplikacia nedoda.
create or replace function public.payments_fill_amount_home()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.amount_home is null then
    new.amount_home := round(new.amount * new.exchange_rate, 2);
  end if;
  return new;
end $$;

drop trigger if exists payments_fill_amount_home on public.payments;

create trigger payments_fill_amount_home
  before insert or update on public.payments
  for each row execute function public.payments_fill_amount_home();

-- Existujuce uhrady boli implicitne v domacej mene.
update public.payments
   set amount_home = amount
 where amount_home is null;

-- `payments.variable_symbol` je tu zamerne aj napriek tomu, ze VS pribuda na
-- `documents`: uhrada moze prist s INYM VS nez ma doklad (preplatok, ciastocna
-- platba, preklep na strane platitela) a pri rieseni nezrovnalosti treba
-- vediet, co realne prislo.
create index if not exists payments_vs_idx
  on public.payments (variable_symbol)
  where variable_symbol is not null;
