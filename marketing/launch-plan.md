# Launch plán — Synapse Faktúra (prvých 30 dní)

Solo founder · cieľ: **prvých 10 platiacich (alebo aktívnych beta) zákazníkov**.
Rámec: ORB kanály + fázový launch (marketing-skills:launch-strategy).

## Východisko
Produkt je hotový v kóde, ešte nenasadený naživo. **Nultý krok = nasadiť** (L2:
hosted Supabase + Stripe live + doména). Bez live URL nemá launch kam viesť.

## ORB kanály (kam sústrediť sily)
- **Owned (buduj hneustále):** e-mailový zoznam (waitlist/newsletter), stránka
  `/e-faktura-2027` ako obsahový magnet, changelog.
- **Rented (vyber 1–2):** **Facebook skupiny slovenských živnostníkov/podnikateľov**
  (najbližšie k cieľovke) + **LinkedIn** (účtovníci, malé firmy). Každý post → vedie
  na landing/registráciu.
- **Borrowed (skratka k dôvere):** slovenskí účtovníci/podnikateľskí tvorcovia obsahu,
  podcasty pre živnostníkov, FB skupiny účtovníkov. Ponúkni free účet + spätnú väzbu.

## Fázy (si v „beta → early access")
1. **Beta (týždeň 1–2):** oslov 1:1 **10–15 živnostníkov, ktorých poznáš** (alebo
   cez známych). Free, výmenou za spätnú väzbu a — ak spokojní — **testimoniál**.
2. **Early access (týždeň 2–4):** verejný launch v SK FB skupinách + LinkedIn s
   témou 2027; zbieraj registrácie, konverzuj na Pro trial.
3. **Full launch (po 30 dňoch):** keď máš 2–3 testimoniály a vychytané chyby →
   širší launch (Product Hunt voliteľne, ale SK cieľovka tam je slabšia — priorita
   sú SK kanály).

## Prvých 30 dní — týždeň po týždni

### Týždeň 0 (príprava)
- [ ] Nasadiť naživo (L2) + otestovať reálny checkout a odoslanie faktúry e-mailom.
- [ ] Zapnúť analytiku (Plausible) — meraj funnel registrácia → 1. faktúra → upgrade.
- [ ] Pripraviť 5–8 screenshotov appky + 30–60s demo video (screen recording:
      „faktúra vetou" za 30 sekúnd — to je tvoj wow moment).
- [ ] Doplniť firemné údaje (`site.ts`) + právna kontrola textov.

### Týždeň 1 — Beta (1:1)
- [ ] Osobne osloviť 10–15 živnostníkov (správa, nie hromadný spam). Skript v
      `marketing/cold-email.md`.
- [ ] S každým 10-min onboarding (aj cez telefón/screen share) — sleduj, kde sa
      zaseknú. Oprav najväčšie trecie miesta.
- [ ] Vypýtať si 1 vetu spätnej väzby → základ testimoniálov.

### Týždeň 2 — Prvý verejný obsah
- [ ] Post do 2–3 SK FB skupín živnostníkov na tému **„Povinná e-faktúra 2027 —
      čo ťa čaká"** (hodnota, nie predaj) → odkaz na `/e-faktura-2027`. (Texty v
      `marketing/social-posts.md`.)
- [ ] LinkedIn post: príbeh „prečo staviam AI fakturáciu pre živnostníkov".
- [ ] Pridať prvé testimoniály na landing (keď ich máš).

### Týždeň 3 — Účtovníci + launch post
- [ ] Cold e-mail sekvencia účtovníkom (multi-org hodnota) — `marketing/cold-email.md`.
- [ ] „Sme live" launch post vo FB skupinách + LinkedIn (demo video + Pro 14 dní zdarma).
- [ ] Odpovedať na KAŽDÝ komentár/správu do pár hodín.

### Týždeň 4 — Vyhodnotenie a zosilnenie
- [ ] Pozri funnel v Plausible: kde padajú? (registrácia? 1. faktúra? upgrade?)
- [ ] Zdvojnásob to, čo fungovalo (kanál/post s najlepším pomerom).
- [ ] Osloviť spokojných beta userov na odporúčanie (referral).

## Ako získať prvých 10 zákazníkov (konkrétne)
1. **Teplé kontakty (najúčinnejšie):** 10–15 živnostníkov, ktorých poznáš → 3–5 z nich.
2. **SK FB skupiny živnostníkov:** hodnotný 2027 obsah + soft CTA → 2–4.
3. **Účtovníci (multi-org):** 1 účtovník = viac firiem naraz → 2–3 cez 1 partnera.
4. **`/e-faktura-2027` SEO + organika:** dlhodobo, náběh týždne–mesiace.

## Metriky (týždenne)
- Registrácie · % dokončený onboarding · % vystavená 1. faktúra · Pro trialy ·
  platiaci. Cieľ 30 dní: **10 aktívnych, z toho ≥3 platiaci/na trial-e**.

## Pravidlo: každá aktivita vedie do owned
Každý FB/LinkedIn post, každý oslovený človek → **registrácia alebo e-mail**.
Rented/borrowed dávajú rýchlosť; owned dáva stabilitu.
