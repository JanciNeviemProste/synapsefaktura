# SYNAPSE FAKTÚRA — Master Build Prompt for Claude Code

> **Working product name:** `Synapse Faktúra` (placeholder — rename freely; it appears as `PRODUCT_NAME` conceptually throughout).
> **Author of brief:** strategic + technical spec prepared June 2026.
> **Reader:** Claude Code (autonomous build agent).
> **Goal:** Build a modern Slovak SaaS invoicing/economic system — a SuperFaktúra-class product with an AI layer SuperFaktúra does not have, and built e-invoice-2027-ready from day one.

---

## 0. HOW TO USE THIS DOCUMENT (read first)

This is a **master plan**, not a single-shot instruction. Do **not** try to build everything in one pass.

1. Read the whole document once to load full context.
2. Build **phase by phase** (Section 8). Finish, test, and self-review each phase before starting the next.
3. Before any large structural step (DB schema, auth model, e-invoice XML mapping), **propose your approach in a short note, then implement**. Keep proposals to the decision points that actually matter.
4. Section 5 (Slovak compliance) contains **hard legal requirements**. You do not know these from training data and must not "simplify" them away. Treat them as a contract.
5. Where Section 5 marks something **[VERIFY BEFORE PROD]**, build to the documented spec but leave a clearly-commented `// TODO: verify against official Finančná správa source` so we re-check before production.
6. Stack is fixed (Section 4). Do not swap core technologies without flagging a concrete blocker.

**Definition of done for each phase:** code compiles, types pass (`tsc --noEmit`), lint passes, the phase's acceptance criteria are met, migrations are reversible, and there's at least smoke-test coverage of the critical path.

---

## 1. PROJECT VISION & POSITIONING

A web-first SaaS for **Slovak (primary) and Czech (secondary)** sole traders (SZČO), freelancers, micro and small businesses, and the accountants who serve them. It does what SuperFaktúra does — issue legally-correct documents fast — but:

- feels like 2026 software, not 2010 (SuperFaktúra's biggest weakness is a dated UI);
- has a **free tier** to capture market share ahead of the 2027 e-invoice mandate (SuperFaktúra has no free tier — a clear gap);
- is **e-invoice-2027 ready by design** (Peppol / EN 16931), so users migrating before the mandate land here;
- adds a genuine **AI layer**: capture, natural-language invoicing, a financial assistant, forecasting, compliance checking, and smart collections.

**One-line pitch (SK):** „Fakturácia novej generácie — vystavíš faktúru jednou vetou, doklady ti vyťaží AI, a si pripravený na povinnú e-faktúru 2027.“

---

## 2. MARKET RESEARCH SUMMARY — what to match, and where the gaps are

### 2.1 SuperFaktúra feature set (the baseline we must meet or beat)

Documents: invoices, proforma/advance (zálohové/preddavkové) invoices, tax documents to received payment (daňový doklad k prijatej platbe), credit notes (dobropisy), delivery notes (dodacie listy), price quotes (cenové ponuky), orders (objednávky — issued & received), drafts (koncepty), recurring invoices (pravidelné faktúry with merge tags like `#MESIAC_SLOVOM#`, `#ROK#`).
Money & ops: expense tracking (náklady), cash registers (pokladne, incl. foreign currency), automatic + manual payment matching (párovanie platieb), bank movement import, online payment links (gateways Barion, Besteron), SMS + email reminders (upomienky), mileage log (kniha jázd), simple stock/price list (sklad/cenník — not full warehouse, no FIFO).
Output & integrations: PDF, **PAY by square** + **INVOICE by square** QR codes, multi-language documents (~9 languages), multi-currency (~15), accounting exports (CSV/XML for the accountant), courier exports, eshop connectors (Shoptet, WooCommerce), public API, mobile apps (iOS/Android), basic document OCR ("digitálne vyťaženie dokladov", paid add-on).
Pricing: 3 tiers, from ~€4.5/mo (annual) basic → premium. 30-day trial, **no free tier**. SMS, postage and OCR are metered extras.

### 2.2 SuperFaktúra's weaknesses (our opportunities)

- Dated UI/UX ("feels like 2010").
- No free tier — bad for solo SZČO and for grabbing pre-2027 market.
- No real LLM/AI — OCR is template-style "vyťaženie", no natural-language, no assistant, no forecasting, no anomaly detection.
- No direct tax-office integration / no real-time digital reporting story.
- Stock is only a glorified price list.
- Limited payment gateways.

### 2.3 Competitor signals (2026)

A wave of SK tools (iDoklad, FLOWii, Účto+, 1faktura, ePošťák, and accounting suites KROS Omega / Pohoda / Money S3) are racing to be **Peppol/e-invoice ready for 2027**, and several lead with a **free plan** to acquire users. AI-native accounting (globally: Vic.ai, Puzzle, Digits, Booke, Docyt, plus Intuit/Xero AI) has converged on a **3-layer model**: (1) capture/extract, (2) reconcile/categorize/ledger, (3) intelligence — forecast, detect anomalies, advise — increasingly **agentic**. No dominant SK player combines a modern UX + free tier + 2027-readiness + a real AI layer. **That intersection is the wedge.**

---

## 3. STRATEGIC WEDGE (bake this into product + marketing copy)

1. **Free + modern + 2027-ready** → win solo SZČO and pre-mandate migrators.
2. **AI that removes typing** → "vystav faktúru jednou vetou", drag-a-photo expense capture, an assistant that answers "koľko som zarobil minulý mesiac".
3. **Correctness as a feature** → with three VAT rates (23/19/5) and rule changes, an AI compliance checker that catches wrong rates/fields before issuing is a real selling point.
4. **Forecasting + smart collections** → predict cash flow and late payers, draft reminders in the right tone at the right time.

---

## 4. TECH STACK & ARCHITECTURE (fixed)

- **Frontend:** Next.js 15 (App Router, Server Components, Server Actions), TypeScript (strict), Tailwind CSS v4, shadcn/ui, lucide-react. Forms: react-hook-form + zod. Data fetching/mutations via Server Actions + Supabase.
- **Backend/data:** Supabase — Postgres, Auth (email + Google), Row Level Security (multi-tenant), Storage (logos, attachments, PDFs, e-invoice XML), Edge Functions for scheduled/async jobs (reminders, recurring invoices, AI batch). Use Supabase migrations (SQL) checked into the repo.
- **Hosting:** Vercel (web). Long-running / heavy async (OCR batches, Peppol polling) may run as Supabase Edge Functions or, if needed, a small worker — abstract this so it can move to a VPS later (Contabo is available).
- **Payments / SaaS billing:** Stripe (subscriptions, tiers, customer portal, webhooks). Use Stripe MCP/API conventions already in use.
- **AI / LLM:**
  - **Reasoning, chat assistant, NL→invoice, compliance, narratives:** Anthropic Claude API (`claude-sonnet-4-6` default for cost/latency; escalate to Opus for hard reasoning if needed).
  - **Document OCR / data extraction (receipts, supplier invoices):** Gemini 2.5 Flash (cheap, strong multimodal OCR; reuse the existing keypool pattern). Wrap behind a `DocumentExtractor` interface so the model is swappable (Claude vision is the fallback).
  - All AI calls go through a single server-side `lib/ai/` layer with: provider abstraction, prompt templates, JSON-schema-validated outputs (zod), token/cost logging per org, and graceful degradation.
- **PDF generation:** `@react-pdf/renderer` for serverless-friendly, pixel-controlled Slovak invoice layouts. (Alternative if layouts get complex: HTML template → Playwright/Puppeteer on a worker — but default to react-pdf.)
- **QR codes:** `bysquare` npm package for **PAY by square** and **INVOICE by square**; Czech **QR Platba** (SPD) for CZ customers. See 5.4.
- **Validation/lookup:** EU **VIES** for IČ DPH (EU VAT) validation; Slovak **RPO** (Register právnických osôb, Štatistický úrad SR) or FinStat-style API for IČO → company autofill. Abstract behind `lib/registry/`.
- **Repo hygiene:** monorepo-style single Next app to start. ESLint + Prettier. `.env.example` documented. No secrets in client bundles — all AI/registry/Stripe calls server-side only.

---

## 5. SLOVAK COMPLIANCE — HARD REQUIREMENTS

> You (Claude Code) do **not** know these reliably. Implement exactly as written. Legal facts below reflect SK law as of 2026.

### 5.1 VAT rates (DPH) — § 27 zákona č. 222/2004 Z. z.

Active rates **from 1.1.2025 onward (incl. 2026):**

- **23 %** — standard (basic) rate. Default for almost everything (IT, marketing, services, most goods).
- **19 %** — reduced (Annex 7/7a items: e.g. restaurant/catering beverages except >0.5% alcohol, selected goods). From 1.1.2026 some high-sugar/high-salt foods moved **back up to 23 %**.
- **5 %** — reduced (basic foods, books incl. e-books, medicines, accommodation, aids for the disabled, etc.).
- **0 % / oslobodené** — exports, intra-EU B2B supplies (reverse charge), and VAT-exempt supplies (healthcare, education, postal, financial...).

**Implementation rules:**

- VAT rate must be a per-line attribute (a single document can mix rates).
- Store rates in a config table with **effective-from/effective-to dates**, so historical documents and credit notes keep their original rate. **Legacy 20 % and 10 % must remain selectable for documents/credit notes dated before 1.1.2025.** Do not hardcode `0.23`.
- Compute and display a **VAT recapitulation (daňová rekapitulácia)** grouped by rate: base, VAT, total per rate, plus document totals.

### 5.2 VAT modes the system must support

- **Platiteľ DPH** (VAT payer) — full VAT.
- **Neplatiteľ DPH** (non-payer) — no VAT lines; must print the legal note **"Nie som platiteľ DPH."**
- **Reverse charge — prenesenie daňovej povinnosti** (domestic §69 cases + intra-EU B2B) — 0% line + mandatory legal note (e.g. "Prenesenie daňovej povinnosti" / "Reverse charge"), buyer's IČ DPH required.
- **Intra-EU B2B / OSS** — country-aware VAT, EU VAT validation, recapitulative statement eligibility.
- **Export (mimo EÚ)** — 0%, exemption note.
- **DPH registration threshold monitoring** (for the AI assistant warnings): turnover watched per **calendar year**; **€50,000** → obligation to apply within 5 working days (payer from next year); **€62,500** → become payer immediately on that supply. (Used for proactive warnings, not blocking.)
- **Edge case [VERIFY BEFORE PROD]:** from 1.1.2026, **50% cap on VAT deduction for mixed business/private vehicles** — relevant to expense/VAT logic and the AI checker.

### 5.3 Invoice mandatory fields — § 74 zákona o DPH (full invoice)

Every issued full invoice (faktúra) must contain:

- Supplier identification: name, address, **IČO**, **DIČ**, and if a payer **IČ DPH**.
- Customer identification: name, address, and IČ DPH where relevant.
- Sequential invoice number (from a controlled sequence).
- Date of issue (dátum vystavenia), date of supply / tax point (**dátum dodania / DUZP**), due date (dátum splatnosti).
- Description, quantity, unit, unit price of goods/services.
- Tax base per rate (základ dane), VAT rate(s), VAT amount(s).
- Total amount due (suma na úhradu), currency.
- Any legal notes required by the VAT mode (see 5.2).
- Payment details: IBAN, variabilný symbol (VS = invoice number is the convention), optional KS/ŠS.
  Also support **zjednodušená faktúra** (simplified invoice, e.g. ≤€100 — fewer fields; note this category is **out of scope of the 2027 e-invoice mandate**, see 5.5).

### 5.4 QR payment codes (mandatory feature, SuperFaktúra parity)

- **PAY by square** — the SK national payment QR standard (approved by the Slovak Banking Association; standard owner Adelante). Encodes IBAN, amount, currency, VS/KS/ŠS, message, due date. Generate it on every **unpaid** issued invoice. Use the `bysquare` library. Show it only while the invoice is unpaid.
- **INVOICE by square** — a second QR encoding full invoice data + tax recapitulation, so the _recipient's_ system can import the invoice (number, address, dates, amounts, VAT breakdown). Provide as an option.
- **Czech customers:** when the customer is in CZ, render the Czech **QR Platba (SPD)** standard instead of the SK PAY by square (SK QR won't load in CZ banking apps). Both standards are supported by `bysquare`-class tooling; branch on customer country.
- Inbound: support reading **INVOICE by square** from a supplier PDF to pre-fill an expense (parity with SuperFaktúra; complements AI capture in 7.1).

### 5.5 E-INVOICE 2027 — zákon č. 385/2025 Z. z. (§ 76a, § 85o zákona o DPH) — **architecture-critical**

This is the strategic centerpiece. Build the architecture **Peppol-ready now**, ship full sending in Phase 4.

**Facts:**

- Legislation in force **1.1.2026**; **mandatory from 1.1.2027** (Phase 1): all **domestic VAT payers** must **issue and receive** e-invoices for **domestic B2B and B2G** supplies. Phase 2 from **1.7.2030**: all taxable persons incl. non-payers + **cross-border** EU.
- A legal e-invoice is **NOT** a PDF or a scan. It is a **structured XML** file conforming to **EN 16931**, in the **Peppol BIS Billing 3.0** profile (built on **UBL 2.1**), delivered **only** via a **certified delivery-service provider ("Digitálny poštár" = Peppol Access Point)** over the Peppol network (4-corner/"5-corner" model — invoices go peer-to-peer via certified intermediaries, plus reporting to the tax authority; **IS EFA** = Finančná správa's e-invoicing information system stores them).
- **Peppol ID** for SK participants format: `0245:[DIČ]` (10-digit DIČ).
- Even **non-payers** must be able to **receive** e-invoices (so the receive path matters for everyone).
- **Exemptions:** B2C, simplified invoices (≤€100), VAT-exempt supplies, and cross-border (until 2030).
- **Sanctions:** up to **€10,000** first breach, up to **€100,000** repeated; from 1.7.2030 e-invoice becomes a condition for **VAT deduction**.
- **2026 is a voluntary/test window** — no penalties — perfect to launch and let users test.

**Design implications:**

- Model documents so a compliant **EN 16931 / Peppol BIS 3.0 (UBL 2.1) XML** can be generated from any invoice (capture all required structured fields from day one — they overlap heavily with § 74).
- Abstract transport behind a `DigitalPostmanProvider` interface (`send(xml)`, `receive()`, `status(id)`, `lookupParticipant(peppolId)`). **Do NOT attempt to build/operate your own certified Access Point initially** — that's a regulated, certified role. For v1, **integrate a certified Digitálny poštár via their API**; keep the option to become an accredited CPDS later.
- Build a **validation step** (EN 16931 business rules + Peppol BIS + SK customizations / SK TDD) before send.
- Build the **inbound** path: receive XML via the AP → parse → auto-create an expense/incoming document (this is where AI capture and structured XML meet).
- **[VERIFY BEFORE PROD]:** exact SK schematron, **SK Solution Architecture (v1.2+)**, **Peppol BIS SK transposition**, and **SK TDD (Tax Data Document)** specs are published by Finančná správa and evolve — pull the latest before certifying. Leave clear TODOs.

### 5.6 Reports & exports the system must produce

- **Daňová rekapitulácia** per document (built into PDF).
- **Kontrolný výkaz DPH** export (XML in FS SR format) — [VERIFY BEFORE PROD] schema. (Note: KV is slated to be replaced by real-time reporting from ~2030.)
- **Súhrnný výkaz** (recapitulative statement, intra-EU) export.
- Sales/income overview, expense overview, **cash-flow** view, profit summary.
- **Accounting export** (CSV + XML) for the user's accountant — like SuperFaktúra (don't force same system as the accountant).
- Full **data export** (GDPR) and account-level export.

### 5.7 Records, GDPR, retention

- EU data residency (Supabase EU region). GDPR-compliant data handling, processing records, deletion/export on request.
- Accounting/invoice retention: keep documents per SK law (e-invoices must be archived in **original XML** form, not just PDF).

---

## 6. DATA MODEL (Postgres / Supabase)

Multi-tenant: almost everything is scoped by `organization_id` with **RLS** so a user only sees their org(s). Use `uuid` PKs, `created_at/updated_at`, soft-delete (`deleted_at`) where appropriate. This is the target shape — turn it into incremental migrations.

```
profiles                -- 1:1 with auth.users (display name, locale, avatar)
organizations           -- the user's company / billing entity
  id, name, legal_form, ico, dic, ic_dph,
  is_vat_payer (bool), vat_mode_default,
  address fields, country, logo_url, signature_url, stamp_url,
  default_currency, default_language, default_due_days,
  peppol_id, einvoice_enabled (bool), digital_postman_provider,
  created_at, ...
organization_members    -- org_id, user_id, role (owner|admin|accountant|member), invited_at
bank_accounts           -- org_id, iban, swift, bank_name, currency, is_default
number_sequences        -- org_id, doc_type, year, prefix/format pattern, next_number, padding
contacts                -- org_id, type(customer|supplier|both),
                           name, ico, dic, ic_dph, address, country,
                           email, phone, default_due_days, peppol_id,
                           payment_behavior_score (nullable), notes
products                -- org_id, name, sku, unit, unit_price, vat_rate, currency, stock_qty (nullable)
vat_rates               -- code, percent, valid_from, valid_to, category_note  (seed: 23/19/5/0; legacy 20/10)
documents               -- the unified document table
  id, org_id, type(invoice|proforma|advance|tax_doc_payment|credit_note|
                    quote|order_issued|order_received|delivery_note|draft),
  number, sequence_id, contact_id,
  issue_date, supply_date /*DUZP*/, due_date,
  currency, exchange_rate, language,
  vat_mode (payer|non_payer|reverse_charge_domestic|intra_eu_b2b|oss|export|exempt),
  status (draft|issued|sent|partially_paid|paid|overdue|cancelled),
  subtotal, vat_total, total, paid_amount,
  notes, footer_notes, legal_notes,
  related_document_id /*advance->final, credit_note->original*/,
  pdf_url, source(manual|ai_nl|recurring|api|import),
  created_by, created_at, ...
document_items          -- document_id, position, description, quantity, unit,
                           unit_price, vat_rate, discount_pct, line_base, line_vat, line_total,
                           product_id (nullable)
payments                -- document_id, amount, paid_at, method(bank|card|cash|other),
                           bank_transaction_id (nullable)
bank_transactions       -- org_id, account_id, amount, currency, vs, ks, ss,
                           counterparty, booked_at, raw, matched_status
expenses /*náklady*/     -- org_id, supplier_contact_id (nullable), document_number,
                           issue_date, supply_date, due_date, currency,
                           subtotal, vat_total, total, vat_rate_breakdown(jsonb),
                           category, tax_deductible(bool), attachment_url,
                           source(manual|ai_capture|peppol_inbound|invoice_by_square),
                           extraction_id (nullable)
recurring_invoices      -- org_id, template(jsonb of a document), contact_id,
                           cadence(weekly|monthly|custom), next_run_at, active,
                           send_method(email|peppol|none), merge_tags supported
reminders /*upomienky*/  -- org_id, document_id, level(1..n), channel(email|sms),
                           scheduled_at, sent_at, tone, body, ai_generated(bool)
einvoices               -- document_id, ubl_xml, peppol_message_id,
                           direction(outbound|inbound), validation_status,
                           transport_status(queued|sent|delivered|failed),
                           is_efa_reference, created_at
ai_extractions          -- org_id, source_file_url, model, raw_response(jsonb),
                           parsed(jsonb), confidence, status, created_at
ai_messages             -- org_id, user_id, thread_id, role, content,
                           tool_calls(jsonb), created_at   -- assistant chat history
ai_usage                -- org_id, feature, model, input_tokens, output_tokens, cost, created_at
forecasts               -- org_id, horizon_days, generated_at, data(jsonb), narrative
audit_log               -- org_id, user_id, action, entity, entity_id, diff(jsonb), at
subscriptions           -- org_id, stripe_customer_id, stripe_sub_id, plan, status,
                           current_period_end
```

**RLS principle:** every tenant table has a policy `using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))`. `profiles` keyed by `auth.uid()`. Service-role only for system jobs (reminders/recurring/Peppol/AI batch).

---

## 7. AI FEATURE SPECIFICATIONS (the differentiators)

All server-side, via `lib/ai/`. Every feature: zod-validated structured output, per-org cost logging (`ai_usage`), confidence/uncertainty surfaced to the user, human-in-the-loop for anything that creates/sends a legal document. **Never auto-issue or auto-send a legal document without explicit user confirmation.**

### 7.1 AI Document Capture (Layer 1) — _beats SuperFaktúra's template OCR_

Drag/drop or email a photo/PDF of a **supplier invoice or receipt** → Gemini 2.5 Flash vision extracts: supplier (name, IČO, IČ DPH), document number, dates (issue/supply/due), line items, per-rate VAT breakdown, totals, currency, IBAN/VS. Auto-match supplier by IČO via registry; create a draft **expense (náklad)** for one-click confirm. Multi-language (SK/CZ/EN/DE...). Handle bad scans gracefully (low-confidence → flag for review). Also ingest **INVOICE by square** QR and **Peppol inbound XML** through the same expense-creation funnel.

### 7.2 Natural-language invoice creation — _killer feature SuperFaktúra lacks_

Free-text → draft invoice. Example: _"vystav faktúru pre Tibora Ozančina, správa Meta Ads za máj 2026, 200 € + DPH, splatnosť 14 dní"_ → Claude (tool-use) resolves the contact, builds line items with correct VAT (23%), sets dates, returns a **draft** for review. Tools: `find_contact`, `find_product`, `create_invoice_draft`. Always opens the draft in the editor — never issues directly.

### 7.3 AI Accounting Assistant (chat over your data) — _Layer 3_

Conversational assistant answering questions about the org's finances via tool-use against the DB (read-only tools + a few guarded write tools that produce drafts). Examples: _"Koľko som vyfakturoval minulý mesiac?"_, _"Ktorí klienti meškajú s platbou a koľko dlhujú?"_, _"Aký je môj cashflow na ďalších 30 dní?"_, _"Pripomeň Petrovi faktúru 2026015."_ Tools: `query_revenue(period)`, `list_overdue()`, `get_cashflow_forecast(horizon)`, `draft_reminder(document_id)`, `summarize_client(contact_id)`. Store threads in `ai_messages`. SK-language by default.

### 7.4 AI VAT / compliance checker — _"correctness as a feature"_

Before issuing, validate the document against Section 5 rules and warn (non-blocking, with one-click fixes): missing mandatory § 74 fields; a VAT rate that doesn't exist on the issue date (e.g. someone picks 20%); likely wrong rate for the item category (heuristic + LLM); reverse-charge/intra-EU needs buyer IČ DPH and the right legal note; non-payer doc must show the "Nie som platiteľ DPH" note; vehicle-related expense VAT cap reminder. Surface as a "compliance score" with explanations.

### 7.5 Cash-flow forecasting + monthly narrative — _Layer 3_

Rolling **30/60/90-day** forecast from: recurring invoices, open receivables, **per-customer payment-behavior model** (e.g. "Customer A pays ~day 45"), and seasonality. Output a chart + a plain-Slovak **monthly narrative** ("Mesačný prehľad"): revenue, top clients, trends, concrete suggestions. Heuristic/statistical core for numbers; Claude for the narrative. Persist in `forecasts`.

### 7.6 Smart reminders / collections — _beats blunt SMS reminders_

Per open invoice, predict lateness (payment-behavior score), choose **optimal send timing**, and have Claude **draft a reminder in an escalating but human tone** (gentle nudge → firm → final notice), in the customer's language. User approves or auto-sends per their settings. Email free; SMS metered (like SuperFaktúra).

### 7.7 Anomaly / duplicate detection — _Layer 3 / internal controls_

Flag likely duplicate invoices/expenses, unusual amounts vs. history, suspicious VAT, and missing-counterpart situations. Surface in the dashboard as "veci na pozretie".

> **AI guardrails (apply everywhere):** structured outputs validated by zod; show confidence; cite which records an answer is based on; never fabricate financial figures — if data is missing, say so; keep all keys server-side; log cost; rate-limit per plan.

---

## 8. PHASED BUILD PLAN

Build in this order. Each phase ends with the acceptance criteria met and a short self-review.

### PHASE 0 — Foundation & scaffolding

- Init Next.js 15 (App Router, TS strict) + Tailwind v4 + shadcn/ui + lucide-react + react-hook-form + zod + ESLint/Prettier.
- Supabase project wiring: client/server helpers, Auth (email + Google), middleware for protected routes.
- First migrations: `profiles`, `organizations`, `organization_members`, `bank_accounts`, RLS policies, seed `vat_rates`.
- App shell: auth pages, dashboard layout (sidebar/topbar), org onboarding wizard (company details with **IČO autofill via RPO**, bank accounts, logo upload, VAT-payer toggle, default language/currency/due days).
- Public marketing landing page shell (hero + pricing placeholder + "2027-ready" messaging).
- **Acceptance:** a user can sign up, create an organization with autofilled company data, and reach an empty dashboard.

### PHASE 1 — Core invoicing MVP (SuperFaktúra parity, core)

- `contacts` CRUD with IČO autofill + IČ DPH VIES validation.
- `products`/cenník CRUD.
- `number_sequences` (per type/year, configurable format).
- **Invoice editor** with full VAT engine (per-line 23/19/5/0, payer/non-payer, reverse charge, intra-EU, export), discounts, multi-currency + exchange rate, document language, live VAT recapitulation + totals.
- Document types: invoice, **proforma/advance**, **tax doc to received payment**, **credit note** (links to original), **quote**, **order** (issued/received), **delivery note**, **draft**.
- **PDF generation** (clean, legally-correct SK layout) with logo/stamp/signature, **PAY by square** + optional **INVOICE by square** QR (CZ → QR Platba).
- Send by email (own SMTP option later), document list with statuses, mark-as-paid, duplicate, PDF download.
- **Acceptance:** issue a fully § 74-compliant invoice (all VAT modes), generate correct PDF with working QR, email it, track status.

### PHASE 2 — Money ops, reminders, recurring, reports

- **Expenses (náklady)** with attachments (manual entry first).
- **Payment matching:** manual + **bank CSV import** → match by VS/amount; partial payments; overpayment handling.
- **Reminders (upomienky):** manual + scheduled (Edge Function cron), email (+SMS provider stub).
- **Recurring invoices (pravidelné faktúry)** with merge tags + auto-issue/auto-send (Edge Function cron).
- **Dashboard:** billing overview, cash position, receivables, overdue, simple charts.
- **Reports/exports:** VAT recapitulation, **Kontrolný výkaz** XML [VERIFY], **Súhrnný výkaz** [VERIFY], income/expense overviews, **accounting export** (CSV/XML), GDPR data export.
- **Acceptance:** end-to-end month: issue → get paid (matched) → see it on dashboard → export for accountant; recurring + reminders run on schedule.

### PHASE 3 — AI layer (differentiators)

Implement `lib/ai/` provider abstraction, then features in this order:

1. **AI Document Capture** (7.1) — highest ROI, reuse known OCR pattern.
2. **Natural-language invoice creation** (7.2).
3. **AI Accounting Assistant** (7.3).
4. **AI VAT/compliance checker** (7.4).
5. **Cash-flow forecast + narrative** (7.5).
6. **Smart reminders** (7.6) — upgrade Phase 2 reminders.
7. **Anomaly/duplicate detection** (7.7).

- **Acceptance:** drag a supplier PDF → confirmed expense in 2 clicks; type one sentence → correct invoice draft; ask the assistant 3 finance questions and get accurate, data-grounded answers; compliance checker catches a deliberately wrong VAT rate.

### PHASE 4 — E-invoice 2027 (Peppol) readiness

- **EN 16931 / Peppol BIS 3.0 (UBL 2.1) XML generation** from any invoice.
- **Validation** (EN 16931 + Peppol BIS + SK customizations) [VERIFY] before send; clear error reporting.
- `DigitalPostmanProvider` interface + integrate **one certified Digitálny poštár** (API). Peppol ID management (`0245:[DIČ]`), participant lookup (SML).
- **Inbound** receive → parse XML → auto-create expense (funnel from 7.1).
- Settings UI: enable e-invoicing, connect provider, test in the 2026 voluntary window.
- **Acceptance:** generate a valid Peppol BIS XML that passes validation; send a test e-invoice via the provider sandbox; receive one and see it become an expense.

### PHASE 5 — Billing, multi-user, polish, launch

- **Stripe** subscriptions: **Free / Pro / Business** tiers (see 8.1), customer portal, webhooks, plan-gating of AI/limits, metered SMS.
- **Multi-user / roles** (owner/admin/accountant/member), org invites, accountant access to multiple client orgs.
- **i18n** UI (SK default, CZ, EN), responsive/mobile, PWA, dark mode.
- Security pass (RLS audit, rate limits, secrets), performance, error monitoring, empty/loading/error states everywhere.
- **Acceptance:** a new user can self-serve from signup → paid plan → inviting their accountant, on mobile, in Slovak.

### 8.1 Suggested pricing (placeholder — SK = US/EU ÷ ~2.5–3; CZ ÷ ~2)

- **Free** — basic invoicing, limited docs/month, **Peppol receive** included (acquisition + 2027 magnet).
- **Pro (~€9–12/mo)** — unlimited docs, AI capture, NL invoicing, assistant, smart reminders.
- **Business (~€19–29/mo)** — forecasting, multi-user, e-invoice **send** (Peppol), advanced reports, API.
- Metered: SMS, extra AI volume. (Final numbers are a business decision.)

---

## 9. CODING STANDARDS & WORKFLOW RULES FOR CLAUDE CODE

- **Work in phases.** Don't scaffold Phase 4 while Phase 1 is unfinished. Finish → test → self-review → next.
- **Propose-then-build** for: DB schema changes, auth/RLS model, VAT engine design, e-invoice XML mapping, AI tool schemas. Keep proposals short and decision-focused.
- **Migrations:** every schema change is a checked-in, reversible Supabase migration. Never edit the DB out of band.
- **Types first:** strict TypeScript; zod schemas for all external/AI/registry inputs and outputs; no `any` on boundaries.
- **Money math:** integer minor units or `decimal`-safe handling; never float-round VAT incorrectly; round per SK conventions; test edge cases.
- **Security:** all AI/registry/Stripe/Peppol calls server-side only; secrets via env; RLS on every tenant table; validate all inputs.
- **No fabrication in AI features:** ground answers in real records; surface uncertainty; human confirmation before issuing/sending legal docs.
- **Tests:** unit-test the VAT engine, numbering, QR payload, and XML mapping; smoke-test critical user flows.
- **Accessibility & states:** every screen has loading/empty/error states; keyboard-accessible; semantic HTML.
- **Commits:** small, logical, conventional-commit messages; keep the build green.
- **When unsure about SK legal specifics:** implement to this doc, leave a `// TODO: verify` with the exact source to check (Finančná správa e-Faktúra section, SK Solution Architecture, EN 16931, SK TDD, Kontrolný výkaz schema). Do not silently guess.

---

## 10. GLOSSARY (SK ↔ EN, for correct domain terms)

- faktúra = invoice; proforma/zálohová/preddavková faktúra = proforma/advance invoice; dobropis = credit note; daňový doklad k prijatej platbe = tax document to a received payment; cenová ponuka = quote; objednávka = order; dodací list = delivery note; koncept = draft.
- DPH = VAT; platiteľ/neplatiteľ DPH = VAT payer/non-payer; sadzba DPH = VAT rate; základ dane = tax base; daňová rekapitulácia = VAT recapitulation; prenesenie daňovej povinnosti = reverse charge; DUZP / dátum dodania = tax point / date of supply; dátum vystavenia = issue date; dátum splatnosti = due date.
- IČO = company ID; DIČ = tax ID; IČ DPH = VAT ID; VS/KS/ŠS = variable/constant/specific symbol; IBAN = account number.
- náklady = expenses; pokladňa = cash register; párovanie platieb = payment matching; upomienka = (payment) reminder; pravidelná faktúra = recurring invoice; kniha jázd = mileage log; sklad/cenník = stock/price list.
- kontrolný výkaz = VAT control statement; súhrnný výkaz = recapitulative statement; daňové priznanie = tax return; paušálne výdavky = flat-rate expenses.
- e-faktúra = e-invoice; Digitálny poštár = certified Peppol Access Point / delivery-service provider; IS EFA = Finančná správa e-invoicing system; PAY by square / INVOICE by square = SK payment / invoice QR standards.

---

## 11. EXECUTION INSTRUCTION

Begin with **Phase 0**. Confirm the stack is installed and the Supabase schema/RLS for the foundation tables is migrated, then implement org onboarding with IČO autofill and the dashboard shell. After Phase 0 passes its acceptance criteria, continue to Phase 1, and so on through Phase 5 — stopping after each phase to verify, type-check, lint, smoke-test, and briefly self-review against this document.

Treat Section 5 as non-negotiable legal correctness, Section 7 as the product's competitive soul, and Section 9 as how we keep the build clean. Build it like it's going to production for real Slovak businesses — because it is.
