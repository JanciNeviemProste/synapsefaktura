# 2026-08-05: Zákonné sadzby z overeného zdroja + branding firmy

**Cestovné náhrady.** Sadzba sa v minulom kole zámerne neseedovala; teraz je
overená **priamo v Zbierke zákonov** (`static.slov-lex.sk`), nie z druhej ruky:

| od         | osobné    | jednostopové | predpis                  |
| ---------- | --------- | ------------ | ------------------------ |
| 1. 5. 2024 | 0,265     | 0,075        | opatrenie 73/2024 Z. z.  |
| 1. 3. 2025 | 0,281     | 0,080        | oznámenie 22/2025 Z. z.  |
| 1. 6. 2025 | 0,296     | 0,085        | oznámenie 97/2025 Z. z.  |
| 1. 1. 2026 | **0,313** | **0,090**    | oznámenie 340/2025 Z. z. |

Aktuálna sadzba potvrdená tromi oficiálnymi zdrojmi. Každý riadok nesie
`source_ref` + `source_url` — pri kontrole je to prvé, na čo sa pýtajú.

- **Kategória vozidla** (`vehicles.category`) je nutná, nie kozmetická: zákon
  má pre motocykel 0,090 oproti 0,313, teda 3,5-násobný rozdiel.
  `resolveTravelRate` vyberá podľa kategórie **aj** dátumu jazdy a sadzbu inej
  kategórie radšej nepoužije, než by dala násobok zákonného stropu.
- **Zmena sa zisťuje, nie vykonáva.** Mesačný cron číta stránku MPSVR; nájdená
  sadzba sa zapíše **nepotvrdená** a `resolveTravelRate` ju ignoruje. Potvrdí
  sa jedným klikom v Nastaveniach. Daňové číslo sa nemá zmeniť samo.
- **Parser overený proti reálnej stránke — a dobre že tak.** Prvá verzia
  vracala `97/2025` namiesto `340/2025` a 0,085 namiesto 0,090: vyzerala
  správne a bola zlá. Stránka totiž uvádza ZMENU („z 0,085 na 0,090"), spomína
  štyri čísla predpisov, u nového má odseknutú koncovku („č. 340/2025 Z.")
  a staršiu účinnosť uvádza skôr než novú. Fixture v testoch si všetky štyri
  pasce drží.
- Poistky, pri ktorých sa nič nezapíše: suma mimo 0,01–2,00 €/km, osobné
  vozidlo nemá vyššiu sadzbu než jednostopové, sadzba je **nižšia** než súčasná
  (zákon ju len zvyšuje → nižšia = chyba parsovania), chýba číslo oznámenia
  alebo dátum účinnosti.

**Branding.** `logo_url`, `signature_url`, `stamp_url` existovali od prvej
migrácie a PDF ich vedelo vykresliť, ale **nikto ich nezapisoval** — dashboard
pritom posielal používateľa doplniť logo do nastavení, kde pole nebolo.

- Všetky tri idú do **súkromného** úložiska (`{orgId}/branding/…`). Verejná
  adresa obrázku podpisu je návod na falšovanie. PDF si súbor sťahuje
  service-role klientom priamo pri generovaní, náhľad v Nastaveniach ide cez
  podpísanú adresu platnú 10 minút.
- **Validácia sa presunula na upload** (`lib/images/validate.ts`) a používajú ju
  obe strany. Dovtedy sa PNG/JPEG a 2 MB kontrolovali až pri renderi, takže
  používateľ nahral 5 MB WebP, dostal „nahraté" a logo mu na faktúre nikdy
  nevyšlo — bez vysvetlenia.
- Upload má rolový guard owner/admin a pri výmene maže starý súbor.

**Pri tom opravené:** `updateOrganization` bez `.select()` overenia — PostgREST
pri zápise odfiltrovanom RLS vráti 204 bez chyby.

**Otvorené:** príplatok +15 % pri použití prívesu (`trips` nemá príznak prívesu)
a automatické zálohovanie (Roman: zatiaľ ručné, v DB nie sú ostré dáta).
