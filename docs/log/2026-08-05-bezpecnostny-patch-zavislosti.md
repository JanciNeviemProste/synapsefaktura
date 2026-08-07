# 2026-08-05: Bezpečnostný patch závislostí

Vyšlo pri kontrole `pnpm audit` po pridaní čítača XLSX — ten je bez nálezu,
na rozdiel od zvyšku.

- **Next 15.5.19 mal osem otvorených advisories** a štyri mieria priamo na
  Server Actions, na ktorých stojí celá appka: HIGH _DoS in App Router using
  Server Actions_, HIGH _SSRF in rewrites_, MODERATE _Unauthenticated
  disclosure of internal Server Function endpoints_, MODERATE _cache
  confusion_. Opravené v 15.5.21 — vnútri už deklarovaného `^15.5.0`, teda
  patch. Nainštalované 15.5.22.
- **`shadcn` bol v `dependencies`**, hoci je to CLI a v kóde sa nikde
  neimportuje. Ťahal do PRODUKČNÉHO stromu 13 nálezov cez
  `@modelcontextprotocol/sdk` → `hono`. Presunutý do `devDependencies`.
- **`postcss` a `sharp` pretlačené cez `pnpm.overrides`.** Next piní postcss na
  8.4.31 so štyrmi advisories. `sharp` je voliteľná závislosť pre Image
  Optimization API a **appka `next/image` nepoužíva ani raz**, takže riziko
  nehrozilo — nula sa však číta lepšie než vysvetlivka.

Výsledok: **`pnpm audit --prod` bez nálezu.** Zostáva 7 v dev nástrojoch
(`brace-expansion`, `js-yaml` cez ESLint); tie bežia len nad naším vlastným
kódom a pretlačenie `js-yaml` vnútri `@eslint/eslintrc` by mohlo zhodiť
načítanie konfigurácie — väčšie riziko než úžitok, ponechané zámerne.

**Pri tom overené na produkcii (len čítanie):** 20/20 migrácií nasadených,
36 tabuliek, 0 bez RLS. Poznámka v tomto súbore, že dve migrácie čakajú na
nasadenie, bola zastaraná.
