# DECISIONS — Synapse Faktúra (ADR)

Architektúrne rozhodnutia, ADR štýl: čo · prečo · zamietnuté alternatívy.
Novšie hore.

## 2026-08-04 · AI poskytovateľ: Gemini 2.5 Flash (`@ai-sdk/google`), OpenRouter ako alternatíva
**Čo:** Jediný LLM backend je Google Gemini 2.5 Flash cez `@ai-sdk/google`
(`GOOGLE_GENERATIVE_AI_API_KEY`, default model `gemini-2.5-flash`). Ak je nastavený
`OPENROUTER_API_KEY`, má prednosť a ide sa cez `@openrouter/ai-sdk-provider`
(default `google/gemini-2.5-flash`); voliteľný `AI_MODEL` prepíše model v tvare
aktívneho backendu. Rozhoduje `aiBackend()` / `aiModel()` v `src/lib/ai/provider.ts`,
`hasAiKey()` drží graceful degradation. Platí pre všetky AI funkcie — capture/OCR,
faktúra vetou, asistent aj zhrnutie kontroly náležitostí.
**Prečo:** Gemini 2.5 Flash je lacný a natívne multimodálny, takže OCR bločkov aj
textové funkcie obslúži jeden model — bez druhého kľúča, druhého SDK a druhej
cenotvorby. OpenRouter dáva prepnutie modelu bez zmeny kódu a jeden účet pre
prípadné ďalšie modely. **Pozn.: `SYNAPSE_FAKTURA_MASTER_PROMPT.md` (§4, §7.2, §7.5,
§7.6) predpisuje Anthropic Claude (`claude-sonnet-4-6`) na reasoning/chat a
Gemini len na OCR. Kód sa od špecifikácie vedome odchýlil; tento záznam je zdroj
pravdy, master prompt je v tomto bode neaktuálny.**
**Zamietnuté:** (1) Claude podľa master promptu — druhý poskytovateľ, druhý kľúč a
vyššia cena za funkcie, kde kvalita Flashu stačí; navyše by OCR aj tak zostalo na
Gemini, teda dva backendy namiesto jedného. (2) Dual-provider routing (Claude na
reasoning, Gemini na OCR) — réžia navyše pre solo-dev bez zmeraného prínosu.
(3) Iba OpenRouter — zbytočný sprostredkovateľ a jediný bod zlyhania, keď väčšina
inštalácií beží priamo na Google kľúči.

## 2026-07-05 · SK compliance overenie (§5)
**Čo:** Overenie `TODO: verify` miest proti oficiálnym/autoritatívnym zdrojom.
Výsledok:

| Oblasť | Súbor | Zdroj | Výsledok |
| --- | --- | --- | --- |
| Peppol EAS `0245` = DIČ SK, `0245:<10 číslic>` | `peppol/id.ts` | docs.peppol.eu EAS code list | **FAKT** |
| DPH sadzby 23/19/5 % od 1.1.2025 | `vat/rates.ts` | novela z. 222/2004 Z. z. | **FAKT** |
| UBL kategórie S/AE/K/G/E/O (UNCL5305) | `peppol/ubl.ts` | docs.peppol.eu UNCL5305 | **FAKT** |
| Jednotky UN/ECE Rec 20 (C62/HUR/KGM…) | `peppol/ubl.ts` | UN/ECE Rec 20 / EN 16931 BT-130 | **FAKT** |
| Reverse charge §69, intra-EU čl. 138 | `vat/legal-notes.ts` | z. 222/2004 §69; smernica 2006/112/ES | **FAKT** |
| 2027 model: 5-corner, UBL 2.1, IS EFA | (architektúra) | Finančná správa / odborné zdroje | **FAKT** |
| neplatiteľ → kategória `O` | `peppol/ubl.ts` | modelové rozhodnutie | **OTVORENÉ** (potvrdiť voči IS EFA) |
| KV/SV XSD root/namespace/sekcie | `export/fs-sr.ts` | FS SR XSD (nie verejné) | **OTVORENÉ** |
| RPO/VIES endpoint tvar | `registry/{rpo,vies}.ts` | — | **OTVORENÉ** (over pri integrácii) |

**Prečo:** §5 je non-negotiable; produkčné tvrdenie o zhode musí byť podložené.
**Zamietnuté:** označiť všetko za hotové bez dôkazu (porušuje §4 anti-halucinácia).

## 2026-07-05 · Email doručovanie cez Resend REST + graceful stub
**Čo:** Odosielanie faktúr/upomienok cez Resend HTTP API (`fetch`), za `hasEmail()`
guardom; PDF príloha z existujúceho `@react-pdf/renderer`.
**Prečo:** Konzistentné s AI/Stripe graceful vzorom — bez `RESEND_API_KEY` appka
beží, len sa neodosiela. `fetch` namiesto SDK = žiadna nová ťažká závislosť.
**Zamietnuté:** Nodemailer/SMTP (konfig. réžia, horšia deliverability), pridanie
`resend` SDK (zbytočná závislosť pre pár volaní).

## 2026-07-05 · Durable rate-limit: Upstash Redis s in-memory fallbackom
**Čo:** `security/rate-limit.ts` použije Upstash Redis REST keď sú env kľúče,
inak súčasný per-process in-memory bucket.
**Prečo:** Serverless (Vercel) má viacero inštancií → in-memory limit netesní
naprieč nimi. Fallback zachová funkčnosť lokálne aj bez Redisu.
**Zamietnuté:** Vercel KV (deprecated), vlastná DB tabuľka (latencia, réžia).

## 2026-06-25 · Peppol transport za `DigitalPostmanProvider` interface (mock zatiaľ)
**Čo:** E-faktúra 2027 posiela cez interface; default `MockPostmanProvider`
(DB loopback). Reálny certifikovaný Digitálny poštár sa zapojí neskôr.
**Prečo:** Certifikovaný access point vyžaduje externú akreditáciu; interface
umožní vývoj a testovanie celej UBL/validation vrstvy bez blokovania.
**Zamietnuté:** priama integrácia jedného poskytovateľa (vendor lock-in, blokuje MVP).

## 2026-06-25 · Stripe billing v test-mode + graceful stub
**Čo:** Plný Stripe kód (checkout/portal/webhook/gating) za `hasStripe()`; bez
kľúčov je každá org Free, gating stále funguje.
**Prečo:** Umožní dokončiť billing UI/logiku pred obchodným rozhodnutím o cenách
a pred live kľúčmi.
**Zamietnuté:** odložiť billing celý (gating treba už teraz), hardcode plánov.

## 2026-06-25 · i18n cez next-intl: cookie locale, bez URL routingu
**Čo:** Jazyk (SK/CZ/EN) v cookie `locale`, default `sk`, deep-merge SK fallback;
doklady/PDF podľa `documents.language`.
**Prečo:** Netreba `/sk/…` prefixy ani duplicitné routy; SK je primárny trh.
**Zamietnuté:** locale-prefixed routing (réžia, SEO tu nepodstatné), i18next
(next-intl lepšie sedí App Routeru).

## 2026-06-24 · Graceful degradation ako prierezový vzor
**Čo:** `hasAiKey`/`hasStripe`/`hasEmail`/`supabaseEnv().configured` — chýbajúci
kľúč nezhodí build ani runtime, len vypne funkciu (fail-open na Edge middleware).
**Prečo:** Jedno nasadenie, postupné zapínanie integrácií; rieši Vercel
`MIDDLEWARE_INVOCATION_FAILED` pri chýbajúcom Supabase env.
**Zamietnuté:** hard-fail na chýbajúce env (rozbije celý web pri prvom deployi).

## 2026-06-24 · Stack: Next.js 15 + Supabase + Tailwind/shadcn + Vercel
**Čo:** App Router + Server Actions; Supabase (Postgres/Auth/RLS) ako multi-tenant
backend; Tailwind v4 + shadcn (Base UI); deploy Vercel.
**Prečo:** Rýchly solo-dev stack, RLS = bezpečná izolácia tenantov na DB úrovni,
Vercel natívny pre Next.
**Zamietnuté:** vlastný Node backend + Prisma (viac réžie, RLS by sa riešila v appke),
Postgres bez RLS (rizikovejšia izolácia).
