# 2026-08-05: Príves, členenie po položkách — a čo bolo vidieť na produkcii

Roman si pozrel nasadenú appku: „vyzerá ako od opice jednoduché". Overené —
Vercel bol v poriadku (deployment `e6a3ef7` = `main`, všetkých 19 stránok,
navigácia pokrýva všetkých 13 modulov). Problém bol inde:

- ⚠️ **`DesignSwitcher` išiel do produkcie.** Bol v globálnom layoute **bez
  `NODE_ENV` guardu**, takže návštevníkovi svietila plávajúca pilulka
  „V0 V1 … V6" s odkazmi na dizajnové štúdie. Overené v HTML nasadenej stránky.
  Prvá vec, ktorú bolo na produkcii vidieť. Teraz sa z produkčného buildu
  odstráni celý (overené: chunky ani HTML ho neobsahujú).
- **Zálohová faktúra sa nedala nájsť.** `FILTER_TYPES` ponúkal 4 typy z 10;
  na proformu sa dalo dostať len ručne napísaným `?type=proforma`. Doplnené
  spolu s daňovým dokladom k platbe.
- Verejnej stránky sme sa od PR #10 **nedotkli ani raz** (0 zmien v
  `src/app/page.tsx` oproti 2 352 riadkom v chránenej oblasti). Prepis landingu
  je samostatné kolo — leží tam šesť hotových variantov `/v1`–`/v6`, všetky
  `noindex` a mimo sitemapy.

**Príves +15 %.** Zákon č. 283/2002 Z. z.: príplatok patrí prívesu
k **štvorkolke alebo osobnému vozidlu**, nie dvoj- a trojkolesovým. To si
vyžiadalo tretiu kategóriu `quad`: pre SADZBU ju oznámenia zlučujú
s motocyklami (0,090), pre PRÍPLATOK ju zákon oddeľuje. Sadzby pre `quad` sa
neseedujú — `resolveTravelRate` ju mapuje na sadzby `motorcycle`.

- ⚠️ **Overené na Postgrese:** `alter type … add value` v transakcii prejde, ale
  POUŽIŤ tú hodnotu v tej istej transakcii Postgres odmietne („unsafe use of
  new value"). Migrácia preto enum len rozširuje.
- Príznak je na **jazde**, nie na vozidle (`trips.with_trailer`) — to isté auto
  ide raz s vlekom a inokedy bez.
- `travelReimbursement` berie dve vedrá km. Jeden súčet × jedna sadzba by
  nesedel hneď, ako by bola časť jázd s vlekom.
- Pri motocykli sa príznak **ignoruje** a UI to povie; tiché pripočítanie 15 %
  by bolo nadhodnotením daňového podkladu.

**Účtovné členenie po položkách.** Štyri stĺpce sa presunuli z dokladu na
položku (`documents` aj `expenses`) — jeden doklad môže niesť riadky z rôznych
stredísk. Doklad má hromadné vyplnenie s tlačidlom „Použiť na všetky položky";
zdrojom pravdy je položka. Hromadné pole sa do formulára prepíše **až
kliknutím**, aby písanie hore ticho neprepísalo členenie nastavené po riadkoch.
