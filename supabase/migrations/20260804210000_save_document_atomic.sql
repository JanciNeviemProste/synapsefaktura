-- ─────────────────────────────────────────────────────────────────────────────
-- Atomicke ulozenie dokladu: hlavicka + polozky v JEDNEJ transakcii.
--
-- PRECO: `saveDocument` zapisoval hlavicku, potom ZMAZAL vsetky `document_items`
-- a vlozil ich nanovo. Cez PostgREST su to tri samostatne volania, teda tri
-- samostatne transakcie — ked zlyhalo to posledne, doklad ostal bez poloziek.
-- Aplikacia to zmiernovala zalohou poloziek v pamati a mazanim rozrobeneho
-- dokladu, ale to je len naplast: medzi mazanim a vkladanim existuje okno, v
-- ktorom doklad polozky naozaj nema, a proces sa moze kedykolvek ukoncit.
-- Skutocnu atomicitu vie dat len databaza — cela funkcia je jedna transakcia.
--
-- ROZHODNUTIE — preco `jsonb_populate_record` nad zoznamom PRITOMNYCH klucov a
-- nie `coalesce` po jednotlivych stlpcoch:
--   `coalesce(nova_hodnota, stara_hodnota)` nevie odlisit "kluc v p_document
--   chyba" od "kluc je explicitne null". Aplikacia pritom null posiela zamerne
--   (zmazanie splatnosti, odviazanie kontaktu, vymazanie poznamky), takze
--   coalesce by tieto zmeny ticho zahodil a pouzivatel by pole nikdy nevymazal.
--   Preto sa SET zoznam sklada z klucov, ktore su v `p_document` SKUTOCNE
--   PRITOMNE (`p_document ? attname`); vsetko ostatne sa stlpca nedotkne.
--   Bonus: kluce, ktore nie su stlpcom `documents`, kataloh odfiltruje sam.
--
-- Prave to je zaroven ochrana pred triggerom `freeze_client_snapshot`: ked
-- `p_document` kluc `client_snapshot` neobsahuje, stlpec sa do UPDATE vobec
-- nedostane, takze `new.client_snapshot` = `old.client_snapshot` a trigger
-- nema co odmietnut. Pri `coalesce` variante by stacilo jedno prehliadnutie a
-- cez zmrazeny snapshot by sa zapisal null.
--
-- Membership sa overuje rovnako ako v `next_document_number`
-- (20260624215655_numbering_system.sql): koncovemu pouzivatelovi (`auth.uid()`
-- je nastavene) sa cudzia organizacia odmietne, service-role volania (cron pre
-- opakovane faktury) maju `auth.uid()` null a su dovervhodne.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.save_document_with_items(
  p_document jsonb,
  p_items    jsonb,
  p_id       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org   uuid;
  v_id    uuid;
  v_cols  text;   -- "a, b, c"           — pre INSERT
  v_sets  text;   -- "a = s.a, b = s.b"  — pre UPDATE
  v_rows  int;
begin
  v_org := nullif(p_document ->> 'organization_id', '')::uuid;
  if v_org is null then
    raise exception 'p_document musi obsahovat organization_id';
  end if;

  if (select auth.uid()) is not null and not public.is_org_member(v_org) then
    raise exception 'Not a member of this organization';
  end if;

  -- Len stlpce, ktore su v p_document skutocne pritomne (viz rozhodnutie vyssie).
  select
    string_agg(quote_ident(a.attname::text), ', ' order by a.attnum),
    string_agg(
      quote_ident(a.attname::text) || ' = s.' || quote_ident(a.attname::text),
      ', ' order by a.attnum
    )
  into v_cols, v_sets
  from pg_attribute a
  where a.attrelid = 'public.documents'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attname <> 'id'
    and p_document ? a.attname::text;

  if v_cols is null then
    raise exception 'p_document neobsahuje ziadny znamy stlpec tabulky documents';
  end if;

  if p_id is null then
    execute format(
      'insert into public.documents (%1$s) '
      'select %1$s from jsonb_populate_record(null::public.documents, $1) '
      'returning id',
      v_cols
    )
    into v_id
    using p_document;
  else
    -- Podmienka na organization_id drzi org scoping aj tu: `security definer`
    -- obchadza RLS, takze filter musi byt vypisany rucne.
    execute format(
      'update public.documents as d set %s '
      'from jsonb_populate_record(null::public.documents, $1) as s '
      'where d.id = $2 and d.organization_id = $3',
      v_sets
    )
    using p_document, p_id, v_org;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'Doklad % sa v organizacii % nenasiel', p_id, v_org;
    end if;
    v_id := p_id;
  end if;

  -- Polozky sa prepisuju cele: zmazanie aj vlozenie je sucastou tej istej
  -- transakcie, takze doklad nikdy nie je navonok viditelny bez poloziek.
  delete from public.document_items where document_id = v_id;

  insert into public.document_items (
    document_id, "position", description, quantity, unit, unit_price,
    vat_rate, discount_pct, line_base, line_vat, line_total, product_id,
    account_code, cost_center, project_code, activity_code
  )
  select
    v_id,
    coalesce(i."position", 0),
    coalesce(i.description, ''),
    coalesce(i.quantity, 1),
    coalesce(i.unit, 'ks'),
    coalesce(i.unit_price, 0),
    coalesce(i.vat_rate, 23),
    coalesce(i.discount_pct, 0),
    coalesce(i.line_base, 0),
    coalesce(i.line_vat, 0),
    coalesce(i.line_total, 0),
    i.product_id,
    i.account_code,
    i.cost_center,
    i.project_code,
    i.activity_code
  from jsonb_populate_recordset(
    null::public.document_items,
    case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end
  ) as i;

  return v_id;
end;
$$;

comment on function public.save_document_with_items(jsonb, jsonb, uuid) is
  'Ulozi hlavicku dokladu aj jeho polozky v jednej transakcii a vrati id '
  'dokladu. UPDATE meni len stlpce, ktorych kluc je v p_document pritomny — '
  'chybajuci kluc = stlpec sa nedotkne (chrani zmrazeny client_snapshot). '
  'Cislo dokladu sa prideluje mimo tejto funkcie cez next_document_number.';
