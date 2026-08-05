# 2026-07-05: Launch v1 — od kódu k prvému zákazníkovi

Nový plán (schválený): L1 právne minimum · L2 live deploy+Stripe · L3 konverzia
(landing/paywall/trial) · L4 SEO+meranie · L5 GTM. Segment: primárne živnostníci
(AI+2027), sekundárne účtovníci. Rýchly platený MVP, default ceny.

- **L1 hotová:** právne stránky `/podmienky` `/ochrana-osobnych-udajov` `/cookies`
  `/kontakt` (SK šablóny — treba právnu kontrolu; údaje v `src/lib/site.ts`),
  zdieľaný `SiteFooter` + `LegalShell`, cookie banner (`useSyncExternalStore`),
  register súhlas checkbox + serverová poistka, **e-mail verifikácia ON**
  (`config.toml` `enable_confirmations=true`) → signUp bez session presmeruje na
  `/registracia-hotova`. 130/130, build green. NEDOTÝKAŤ pozn.: `SITE.company`
  má placeholdery `[DOPLŇ …]` — používateľ doplní reálne firemné údaje.
- **L3 + L4 + L2-kód hotové (dorob to celé):**
  - **L3:** landing napojený na `PLANS` (reálne ceny + porovnávacia tabuľka + FAQ +
    sekcia 2027); in-context paywall `UpgradeDialog` + `UpgradeProvider`
    (shell layout) — gated actions vracajú `upgrade?: PlanTier` (documents/ai/
    einvoice/members), 4 call-sites otvárajú dialóg; 14-dňový Pro trial v checkoute;
    dashboard „Začíname" karta (first-run). Zdieľaný `feature-labels.ts`.
  - **L2-kód:** Stripe `automatic_tax` + `billing_address_collection` +
    `tax_id_collection` na checkout (aktivuje sa so Stripe Tax).
  - **L4:** `sitemap.ts`, `robots.ts`, OG/Twitter metadata + `metadataBase`,
    SEO magnet `/e-faktura-2027`, Plausible analytics (graceful, `analytics.tsx` +
    `analytics/track.ts`). Sentry ODLOŽENÉ (dokumentované v README).
  - 130/130, build green (nové routy /e-faktura-2027, /sitemap.xml, /robots.txt).
- **Landing copy + marketing (copywriting/launch/pricing/social/cold-email skills):**
  landing prepísaný na konverzný (`bd7818b`); `marketing/{launch-plan,pricing,
social-posts,cold-email}.md` + `.agents/product-marketing-context.md` (`3433fbd`).
  Pricing odporúčanie: nechať 0/12/29 €, pridať ročné (−17 %), overiť WTP na beta.
- **Next (akcie používateľa):** env/kľúče (Stripe live+produkty+Tax, PLAUSIBLE,
  RESEND/UPSTASH), hosted Supabase+deploy+doména, firemné údaje v `src/lib/site.ts`,
  právna kontrola, reálne screenshoty, `scripts/pentest.sh` po deployi. Potom „GO L2"
  = sprievodca nasadením (Supabase → Vercel → Stripe).
