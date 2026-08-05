# 2026-08-05: Nová úvodná stránka s postavou + jednotný dizajn appky

Roman poslal hotový návrh hero stránky (celoobrazovkové video s postavou,
biele pozadie, čierna typografia, pilulky, písací efekt) a chcel ho na úvodnej
stránke — s tým, že vnútro appky nemusí mať postavu, ale má vyzerať rovnako.

**Dve veci z návrhu sa prevziať nedali.**

- **Fonty.** `db.onlinewebfonts.com` servíruje _Helvetica Now Display_
  s hlavičkou „licensed by CC BY 4.0". To nie je pravda — je to komerčný font
  Monotype a ide o neautorizovanú kópiu. Namiesto toho **Inter Tight** (OFL,
  `next/font/google`, self-hostovaný pri builde). `latin-ext` je povinné:
  bez neho by slovenská diakritika vypadla na náhradný font uprostred slova.
- **Video** viedlo do cudzieho používateľského priečinka na CloudFronte.
  Stiahnuté k nám do `public/hero/`.

⚠️ **`--font-sans` odkazoval sám na seba.** V zostavenom CSS bolo doslova
`--font-sans:var(--font-sans)`, teda neplatná hodnota — **Geist sa načítaval,
ale NIKDY neaplikoval** a celá appka bežala v systémovom písme. Časť dojmu
„vyzerá to jednoducho" išla presne odtiaľto. Po tejto skúsenosti sa font
neoveruje pohľadom, ale v zostavenom CSS a cez `getComputedStyle`.

**Video bolo treba prekódovať, inak by efekt sekal.** Zdroj mal 3828×2164
a **jediný kľúčový snímok na 97 snímkov** — každý pohyb myšou dozadu by
znamenal dekódovať 4K od začiatku klipu. Prekódované na 1920 px s kľúčovým
snímkom každých 5: **4480 kB → 1696 kB**, 1 → 20 kľúčových snímkov.
`ffmpeg` sa nainštaloval mimo repa (`ffmpeg-static` v scratchpade), aby
z toho nevznikla trvalá závislosť.

**Čo návrh neriešil a bez toho by bolo pokazené:**

- dotykové zariadenia nemajú `mousemove` → video by navždy stálo na prvom
  snímku; pri `pointer: coarse` sa pustí ako tichá slučka,
- `prefers-reduced-motion` → statický snímok a text bez písania,
- pilulka s e-mailom bola **biela**, lebo v návrhu ležala na tmavej časti
  videa; naše video je svetlé, takže bola neviditeľná,
- na mobile ju prekrývala lišta so súhlasom s cookies,
- symbol **® nepreberáme** — značka registrovaná nie je.

**Vnútro appky = zmena TOKENOV, nie obrazoviek.** Komponenty v
`components/ui/` čítajú `--radius`, `--border` a `font-heading`, takže sa
appka preberie naraz. Tlačidlá sú pilulky — najviditeľnejší tvar drží landing
a vnútro pri sebe. Landing je **vždy svetlý** (`.landing-light`): hero stojí
na svetlom videu, takže v tmavom režime by hneď pod prvou obrazovkou vznikol
ostrý zlom.

⚠️ **Pri kontrole nasadenej stránky sa našla vlastná chyba:** landing mal päť
`h2` a **nula `h1`**, hoci starý ho mal. Rozmazaný riadok bol `p`
s `aria-hidden` + zdvojený `sr-only` text; teraz je z neho `h1`. Písaný text
navyše dopisoval až JS, takže v serverovom HTML nebol vôbec — doplnený ako
neviditeľná kópia, ktorá po dopísaní zmizne (overené, že sa nezdvojuje).

**Overené v prehliadači (Playwright), nie od oka:** `getComputedStyle(body)`
vracia `"Inter Tight"`; fonty sú self-hostované v 30 súboroch bez volania na
cudziu doménu; pohyb myšou naozaj mení `video.currentTime`; odfotené desktop,
sekcie pod hero, cenník, mobil aj mobilné menu; žiadna chyba v konzole.

**Otvorené:** či pretáčanie pôsobí plynulo na skutočnom stroji (Playwright
potvrdí zmenu času, nie dojem) a vlastné video namiesto prevzatého.
