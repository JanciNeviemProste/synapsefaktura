-- ─────────────────────────────────────────────────────────────────────────────
--  Synapse Faktúra — prepínače tlače dokladu ako skutočné prepínače
--
--  Migrácia 20260804200000 zaviedla `show_prices`, `show_qr_payment` a
--  `show_signature` ako `boolean not null default …`. Žiadny kód ich odvtedy
--  nečítal ani nezapisoval — o tom, čo sa na doklade tlačí, rozhoduje výhradne
--  typ dokladu (`src/lib/documents/presentation.ts`).
--
--  PROBLÉM: v tomto tvare sa nedajú zapojiť. `not null default true` znamená,
--  že každý existujúci doklad má `show_prices = true` — vrátane dodacích
--  listov, ktoré sa tlačia BEZ cien. Keby ich prezentačná vrstva začala čítať,
--  zapla by ceny na každom dodacom liste. Stĺpec nevie odlíšiť „používateľ to
--  vedome zapol" od „nikto to nikdy nenastavil".
--
--  RIEŠENIE: `null` = „rozhodne typ dokladu", `true`/`false` = vedomé
--  rozhodnutie používateľa. Existujúce hodnoty sa vynulujú, pretože žiadna
--  z nich rozhodnutím nebola — sú to nedotknuté defaulty.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.documents
  alter column show_prices     drop default,
  alter column show_qr_payment drop default,
  alter column show_signature  drop default;

alter table public.documents
  alter column show_prices     drop not null,
  alter column show_qr_payment drop not null,
  alter column show_signature  drop not null;

-- Bezpečné práve preto, že tieto stĺpce nikdy nikto nečítal ani nezapisoval:
-- nie je čo stratiť. Keby ich kód používal, patril by sem výber podľa typu
-- dokladu, nie plošné `null`.
update public.documents
   set show_prices     = null,
       show_qr_payment = null,
       show_signature  = null;

comment on column public.documents.show_prices is
  'null = podľa typu dokladu (presentation.ts), inak vedomé rozhodnutie. '
  'Dodacie listy sa bežne vystavujú bez cien, časť odberateľov ich však chce.';
comment on column public.documents.show_qr_payment is
  'null = podľa typu dokladu. Platí len tam, kde doklad tlačí ceny a je '
  'výzvou na úhradu — QR kód nesie sumu, ktorú by doklad inak neuvádzal.';
comment on column public.documents.show_signature is
  'null = podľa typu dokladu. Miesto na podpis pri prevzatí (dodací list).';
