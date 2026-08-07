# 2026-08-04: Recenzia fáz 1–6 a opravy (PR #10)

Sedem naskladaných PR (#3–#9) prešlo recenziou. Nálezy overené v kóde, nie
prevzaté; adversárne preverenie dva z nich spresnilo.

- **Bezpečnosť:** `save_document_with_items` je `security definer` a zoznam
  stĺpcov berie z klientovho JSON. `EXECUTE` mal `PUBLIC`, takže ktokoľvek
  prihlásený mohol cez RPC nastaviť `total`, `paid_amount` či `status` priamo,
  s obídením prepočtu v `saveDocument`. Právo odobraté (`20260805090000`),
  volá sa service-role klientom.
- **Daňový podklad:** detail vozidla podával služobné km spolu s _celým_
  nakúpeným palivom → uznateľné palivo nadhodnotené takmer o 100 % (60 l
  namiesto 35 l na kontrolnom príklade). Nová čistá funkcia
  `deductibleBusinessFuel`: najprv `min(normovaná za všetky km, nakúpené)`,
  až potom služobný podiel.
- **Peniaze:** výsledok `recordPayment` sa zahadzoval → transakcia sa označila
  `matched`, platba v DB nebola a dedup ju pri ďalšom importe preskočil.
  Odchodzie platby sa knihovali aj bez VS (mzdy a paušály so zhodnou sumou).
- **Cudzí IBAN:** `renderInvoicePdf` nefiltroval doklad na organizáciu.
- **Cross-org zápis:** `updateProduct`/`deleteProduct` bez org filtra.
- **Falošný úspech mazania:** `for delete using (has_org_role(...))` + kontrola
  len `error` → PostgREST vráti 204 bez chyby. Nový `writeOutcome`.
- Dobropis dostal záporné znamienko; `stock_qty` má jedného zapisovateľa;
  bankové účty rolový guard; `parseType` cez `Object.hasOwn`.
- **Overené:** 356/356 testov, 15 migrácií načisto, všetkých 7 medzistavov
  stacku lokálne zelené (CI ich nikdy nespustilo).
- **Otvorené (rozhodnutie o rozsahu, nie chyba):** ~1 500 riadkov zavedenej,
  ale nepoužitej schémy a kódu — `LogbookSummary`, `TagPicker`,
  `expense_payments`, `travel_rates`, číselné rady pokladne, `send_method`.
  Dobropisy navyše nevstupujú do výkazov (`.eq("type","invoice")`).
