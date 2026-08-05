# 2026-08-05: XLSX import, nahrávanie veľkých súborov a OCR bločka

Roman použil appku a napísal: „chcem XLSX a potrebujem aby sa dali nahrávať aj
väčšie súbory naprav to a potom otestuj loga a aj bločky bločky fungujú na
OCR?"

**Strop Vercelu.** Predchádzajúce kolo zdvihlo `bodySizeLimit` na `"8mb"` — a
to bol omyl: **Vercel má tvrdý strop 4,5 MB na telo serverovej funkcie**
(`FUNCTION_PAYLOAD_TOO_LARGE`) a nastavenie ho vie len znížiť, nie prekonať.
Sľuboval teda viac, než platforma vie doručiť. Znížené na 4 MB.

Veľké súbory preto cez server action **už nechodia vôbec**. Prehliadač ich
posiela priamo do úložiska cez podpísaný lístok (`actions/uploads.ts` +
`lib/upload/direct.ts`). Fotka bločka má 25 MB, logo 8 MB.

- Cestu určuje **výhradne server** (`{orgId}/…`); názov súboru sa čistí, takže
  ním nejde vybočiť z priečinka.
- Obsah sa overuje **až po nahratí** (magické bajty + skutočná veľkosť) —
  deklarovaný typ z prehliadača nikoho nezaväzuje. Keď neprejde, súbor sa hneď
  **aj zmaže**, inak by v buckete zostal sirotinec.
- Dialóg vyťaženia posielal ten istý súbor **dvom akciám naraz** — na mobilných
  dátach dvojnásobný upload. Teraz ide po drôte raz.

**OCR bločka — tri tiché chyby.**

- **Formát sa bral z prehliadača.** Prázdny `file.type` (bežné pri zdieľaní
  z Androidu) šiel modelu ako `application/octet-stream`, model vrátil 400
  a používateľ videl „AI volanie zlyhalo." — hláška, ktorá s príčinou
  nesúvisí. Teraz sa určuje z obsahu; HEIC z iPhonu je rozpoznaný a zošit
  Excelu sa pomenuje adresne, pričom **model sa vôbec nezavolá**.
- **Sadzba DPH sa hádala.** Pri nevyťaženej sadzbe sa natvrdo dosadilo 23 %.
  Na potravinovom bločku (19 %) to bola tichá chyba v daňovom podklade.
  `deriveVatRate` ju dopočíta zo súm a keď to nejde, nechá 0 % — **nula je
  viditeľná, 23 % nie.**
- **Položky sa vyťažili a zahodili**, takže bloček s dvomi sadzbami sa nedal
  zaevidovať správne.

**Vyťažené údaje sa dajú opraviť.** Dialóg ich dovtedy len vypisoval a pod nimi
stálo „Skontroluj údaje" — skontrolovať sa dali, opraviť nie. Pri jedinej zle
prečítanej číslici ostávalo prijať nesprávny doklad, alebo zahodiť aj to, čo AI
prečítala správne. `parseAmount` berie desatinnú čiarku aj menu; nesediaci
súčet upozorní, ale nezamkne (bloček s vlastným zaokrúhlením existuje).

**XLSX import klientov.** `read-excel-file` vedľa CSV; obe cesty končia
v spoločnom `contactsFromRows`, takže sa nemôžu rozísť. **SheetJS zamietnutý:**
`xlsx@0.18.5` má CVE-2023-30533 (prototype pollution) a CVE-2024-22363 (ReDoS)
a opravené verzie sú len na vlastnom CDN — pre verejné repo nepoužiteľné.

**Pri tom opravené:** `uploadAttachment` už nikto nevolal (zmazané, nie
ponechané ako mŕtvy kód); hláška pri priveľkom logu tvrdila „najviac 2 MB",
hoci kontrola používala iný limit — texty sa teraz odvodzujú z limitu.

⚠️ **Čo NIE JE overené end-to-end:** **WSL na tomto stroji nie je
nainštalované**, takže Docker Desktop nemá ako naštartovať linuxový engine
a lokálny Supabase sa nespustí; Vercel CLI nie je prihlásený a AI kľúč lokálne
nie je. Overené je všetko okrem samotného volania modelu a Supabase Storage —
tie dva kroky treba preklikať v nasadenej appke.
