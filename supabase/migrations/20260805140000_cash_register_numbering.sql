-- ─────────────────────────────────────────────────────────────────────────────
--  Synapse Faktúra — číselné rady pokladne
--
--  `cash_registers.sequence_in_id` a `sequence_out_id` existujú od migrácie
--  20260804180000, ale nikto ich nenastavoval ani nečítal. Číslo pokladničného
--  dokladu bolo voľný text bez unikátneho indexu. Pri pokladničnej knihe je
--  pritom súvislý číselný rad zákonná požiadavka.
--
--  PREČO NIE VLASTNÉ ČÍSLOVANIE: druhý číselný systém vedľa `number_sequences`
--  by znamenal dve miesta, kde sa dá prideliť číslo, a dva spôsoby, ako sa to
--  môže rozísť. Preto sa použije tá istá tabuľka.
--
--  ČOHO SA TÁTO MIGRÁCIA ZÁMERNE NEDOTKNE: unikátneho obmedzenia
--  `(organization_id, doc_type, year)`. Na ňom stojí `on conflict` v
--  `next_document_number` — jeho zrušenie by zhodilo prideľovanie čísel faktúr.
--  `doc_type` sa preto len zmení na nullable: Postgres považuje NULL hodnoty
--  v unikátnom indexe za navzájom rôzne, takže pokladničné rady doň nespadnú
--  a `on conflict` pre doklady funguje presne ako doteraz.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.number_sequences
  alter column doc_type drop not null;

alter table public.number_sequences
  add column if not exists kind text not null default 'document',
  add column if not exists cash_register_id uuid
    references public.cash_registers (id) on delete cascade;

-- Rad je buď dokladový (má `doc_type`), alebo pokladničný (má pokladňu).
-- Nikdy oboje a nikdy ani jedno — inak by vznikol rad, ktorý nikam nepatrí.
alter table public.number_sequences
  drop constraint if exists number_sequences_kind_target;
alter table public.number_sequences
  add constraint number_sequences_kind_target check (
    (kind = 'document' and doc_type is not null and cash_register_id is null)
    or (kind in ('cash_in', 'cash_out')
        and doc_type is null and cash_register_id is not null)
  );

-- Jedna pokladňa má najviac jeden príjmový a jeden výdavkový rad.
create unique index if not exists number_sequences_cash_uidx
  on public.number_sequences (cash_register_id, kind)
  where cash_register_id is not null;

comment on column public.number_sequences.kind is
  'document = rad dokladov (kľúčovaný doc_type + year), cash_in / cash_out = '
  'rad pokladničných dokladov (kľúčovaný cash_register_id).';

-- ── prideľovanie čísla z radu podľa id ───────────────────────────────────────
-- `next_document_number` adresuje rad cez (org, doc_type, year). Pokladňa má na
-- svoj rad priamy odkaz, takže potrebuje adresovanie cez id.
--
-- Prechod roka: dokladové rady majú rok v kľúči a vzniká nový riadok. Pokladňa
-- má na rad FK, ktorý musí prežiť, takže rok drží riadok a pri jeho zmene sa
-- číslovanie resetuje na 1. Bez toho by druhý rok pokračoval číslom 843 —
-- súvislý rad síce, ale nečitateľný.
create or replace function public.next_sequence_number(
  p_sequence_id uuid,
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
  select * into v_seq
  from public.number_sequences
  where id = p_sequence_id
  for update;

  if v_seq.id is null then
    raise exception 'Sequence not found';
  end if;

  -- Rovnaká kontrola ako v `next_document_number`: volanie bez prihláseného
  -- používateľa (cron, service role) prejde, cudzia organizácia nie.
  if (select auth.uid()) is not null
     and not public.is_org_member(v_seq.organization_id) then
    raise exception 'Not a member of this organization';
  end if;

  if v_seq.year <> p_year then
    v_num := 1;
    update public.number_sequences
    set year = p_year, next_number = 2
    where id = v_seq.id;
  else
    v_num := v_seq.next_number;
    update public.number_sequences
    set next_number = next_number + 1
    where id = v_seq.id;
  end if;

  v_result := v_seq.format;
  v_result := replace(v_result, '{prefix}', coalesce(v_seq.prefix, ''));
  v_result := replace(v_result, '{year}', p_year::text);
  v_result := replace(v_result, '{seq}', lpad(v_num::text, v_seq.padding, '0'));
  return v_result;
end;
$$;

-- Rovnaký zámok ako pri `save_document_with_items`: funkcia je `security
-- definer`, takže obchádza RLS. Priame volanie cez PostgREST by koncovému
-- používateľovi umožnilo míňať čísla z cudzieho radu.
revoke execute on function public.next_sequence_number(uuid, int)
  from public, anon, authenticated;
grant execute on function public.next_sequence_number(uuid, int)
  to service_role;

-- ── číslo pokladničného dokladu musí byť v rámci pokladne jedinečné ──────────
-- Bez tohto indexu by súvislosť radu zaručovala len aplikácia a jeden súbežný
-- zápis by vyrobil dve rovnaké čísla.
create unique index if not exists cash_register_items_number_uidx
  on public.cash_register_items (cash_register_id, number)
  where number is not null;
