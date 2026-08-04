-- Snapshot odberatela na doklade.
--
-- PRECO: doklad ma dnes len `documents.contact_id` -> `contacts`. Ked odberatel
-- zmeni nazov, adresu alebo IC DPH, zmena sa cez cudzi kluc premietne aj na
-- VSETKY uz vystavene faktury. Na uctovnom doklade sa vsak udaje odberatela
-- k datumu vystavenia menit nesmu.
--
-- Riesenie: popri vazbe drzime aj KOPIU udajov v case vystavenia. Vazba
-- zostava (na prekliky a reporty), snapshot je to, co sa tlaci.
--
-- PORADIE: snapshot sa napln a pri VYSTAVENI dokladu (prechod draft -> issued),
-- nie pri kazdom ulozeni. Kym je doklad koncept, `client_snapshot` je NULL
-- a udaje sa citaju zivo z `contacts` — presne ako doteraz.

alter table public.documents
  add column if not exists client_snapshot jsonb;

comment on column public.documents.client_snapshot is
  'Kopia udajov odberatela k okamihu vystavenia. Napln a sa raz, pri prechode '
  'zo stavu draft do issued, a uz sa nemeni. Kym je NULL, doklad je koncept '
  'a udaje sa citaju zivo z contacts.';

-- Ocakavane kluce: name, ico, dic, ic_dph, street, city, postal_code, country,
-- email, phone, delivery_* , iban, swift, snapshot_at.
alter table public.documents
  drop constraint if exists documents_client_snapshot_shape;

alter table public.documents
  add constraint documents_client_snapshot_shape check (
    client_snapshot is null
    or (jsonb_typeof(client_snapshot) = 'object' and client_snapshot ? 'name')
  );

-- ── Zamedzenie prepisu ──────────────────────────────────────────────────────
-- Ked uz raz snapshot vznikol, nesmie sa zmenit. To je cely ucel tejto
-- migracie, takze sa to vynucuje v databaze, nie len v aplikacii.
create or replace function public.freeze_client_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.client_snapshot is not null
     and new.client_snapshot is distinct from old.client_snapshot then
    raise exception
      'client_snapshot je uz zmrazeny pre doklad % a neda sa zmenit', old.id
      using hint = 'Ak treba opravit udaje odberatela, vystav opravny doklad.';
  end if;
  return new;
end $$;

drop trigger if exists documents_freeze_client_snapshot on public.documents;

create trigger documents_freeze_client_snapshot
  before update on public.documents
  for each row execute function public.freeze_client_snapshot();

-- POZN.: backfill uz vystavenych dokladov sa tu ZAMERNE nerobi. Historicke
-- udaje odberatela uz nie su k dispozicii, takze by sa doplnili AKTUALNE —
-- co je len odhad a tvarilo by sa to ako fakt. Ak sa preň niekto rozhodne,
-- patri do samostatneho skriptu s priznakom `backfilled: true` v jsonb.
