-- ─────────────────────────────────────────────────────────────────────────────
-- save_document_with_items sa odoberá bežným používateľom.
--
-- PRECO: funkcia je `security definer` (obchadza RLS na `documents`) a zoznam
-- zapisovanych stlpcov si berie z toho, co posle klient v `p_document`. Jedina
-- kontrola je clenstvo v organizacii.
--
-- PostgreSQL pri `create function` udeluje EXECUTE roli PUBLIC a Supabase
-- vystavuje funkcie schemy `public` ako RPC endpoint. Ktokolvek prihlaseny teda
-- mohol poslat
--
--     POST /rest/v1/rpc/save_document_with_items
--
-- s lubovolnym `p_document` a nastavit si `total`, `subtotal`, `vat_total`,
-- `paid_amount`, `status` alebo `number` priamo — s obidenim celeho prepoctu
-- v `saveDocument`, ktory sumy zamerne rata na serveri a klientovi neveri.
-- V organizacii s viacerymi clenmi si tak `member` mohol oznacit fakturu za
-- uhradenu alebo vynulovat jej sumu.
--
-- RIESENIE: pravo sa odobera. Funkciu vola vylucne server action cez
-- service-role klienta, ktory `orgId` berie z overeneho `getCurrentOrgId`,
-- nie z requestu. Whitelist stlpcov by tu nestacil — `saveDocument` legitimne
-- zapisuje prave tie stlpce, ktore treba klientovi zakazat, takze rozlisit ich
-- vnutri funkcie nejde. Rozhoduje, KTO vola.
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.save_document_with_items(jsonb, jsonb, uuid)
  from public, anon, authenticated;

-- Ponechane len service_role (a vlastnikovi funkcie). Explicitne, nech je
-- zamer citatelny aj bez znalosti predvolenych prav Postgresu.
grant execute on function public.save_document_with_items(jsonb, jsonb, uuid)
  to service_role;

comment on function public.save_document_with_items(jsonb, jsonb, uuid) is
  'Ulozi hlavicku dokladu aj jeho polozky v jednej transakcii a vrati id '
  'dokladu. UPDATE meni len stlpce, ktorych kluc je v p_document pritomny — '
  'chybajuci kluc = stlpec sa nedotkne (chrani zmrazeny client_snapshot). '
  'LEN PRE service_role: funkcia je security definer a doveruje zoznamu '
  'stlpcov od volajuceho, takze sa nesmie vystavit koncovemu pouzivatelovi. '
  'Cislo dokladu sa prideluje mimo tejto funkcie cez next_document_number.';
