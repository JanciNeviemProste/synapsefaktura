# Prihlásenie a registrácia — nastavenie Supabase Auth

**Registrácia v produkcii funguje.** Overené 2026-08-08 skutočným priechodom:
účet vznikol a rovno prišiel prístupový token. Skúšobný účet bol po teste
zmazaný.

## Auth nastavenie žije v repozitári, nie v dashboarde

Od 2026-08-08 je konfigurácia Auth v `supabase/config.toml`, v bloku
`[remotes.production]`. Aplikuje sa príkazom:

```bash
supabase login          # raz, vo vlastnom termináli (potrebuje prehliadač)
supabase link --project-ref oukooqfpxeunhdzndsid
supabase config push
```

**Nemeň to klikaním v dashboarde.** Predtým to tak bolo a nikto nevedel, čo je
kde nastavené — Site URL bola omylom `http://` namiesto `https://` a nikto si
toho nevšimol, lebo sa to nedalo porovnať s ničím. Teraz je zmena vidieť
v `git diff` a prejde cez PR.

`config push` pred zápisom vypíše rozdiel a pýta si potvrdenie.

---

## Stav

|                                  | stav                                   | poznámka                       |
| -------------------------------- | -------------------------------------- | ------------------------------ |
| Site URL                         | ✅ `https://synapsefaktura.vercel.app` | opravené z `http://`           |
| Povolené presmerovania           | ✅ vrátane produkčného callbacku       |                                |
| Potvrdzovanie e-mailom           | ⚠️ **dočasne vypnuté**                 | viď nižšie                     |
| Prihlásenie cez Google           | ❌ vypnuté                             | potrebuje Google Cloud Console |
| Ochrana proti prezradeným heslám | ❌ nedostupná                          | platená funkcia, viď nižšie    |

---

## 1. Site URL a presmerovania — hotové

V `[remotes.production.auth]` je `site_url`, zoznam povolených presmerovaní sa
dedí z `[auth] additional_redirect_urls`.

### Overenie

```bash
curl -s -o /dev/null -w "%{redirect_url}\n" \
  "https://oukooqfpxeunhdzndsid.supabase.co/auth/v1/verify?token=x&type=signup&redirect_to=https://synapsefaktura.vercel.app/auth/callback"
```

Správne je, keď sa adresa vráti **presne tak, ako bola poslaná**. Ak sa zmení
na niečo iné, presmerovanie nie je v zozname — GoTrue ho ticho nahradí Site URL
a chybu nenahlási. Presne na tomto to predtým padalo.

---

## 2. Potvrdzovanie e-mailom — dočasne vypnuté

`[remotes.production.auth.email] enable_confirmations = false`.
Rozhodnutie vlastníka z 2026-08-08.

**Prečo:** vstavané odosielanie Supabase má strop 2 e-maily za hodinu a doručuje
**iba na adresy členov projektu**. Registrácia z cudzej adresy tak vytvorila
účet, ktorý sa nedal potvrdiť.

**Čo to stojí:** ktokoľvek sa vie zaregistrovať na cudziu e-mailovú adresu.
Na ostrú prevádzku to takto **nesmie zostať** — rieši to issue #35.

### Ako to zapnúť späť

1. **V Resende overiť doménu.** Bez toho sa dá posielať len na vlastnú adresu,
   takže zákazník potvrdenie nedostane a nič sa nezlepší.
2. Do `[remotes.production.auth.email.smtp]` doplniť:

   | pole          | hodnota                                          |
   | ------------- | ------------------------------------------------ |
   | `host`        | `smtp.resend.com`                                |
   | `port`        | `465`                                            |
   | `user`        | `resend`                                         |
   | `pass`        | `env(RESEND_API_KEY)` — kľúč do repa **nepatrí** |
   | `admin_email` | adresa na overenej doméne                        |

3. `enable_confirmations = true`, `supabase config push`.
4. Zvýšiť `[auth.rate_limit] email_sent` — hodnota 2 je strop vstavaného
   odosielania a s vlastným SMTP nedáva zmysel.

---

## 3. Prihlásenie cez Google — nezapnuté

Bez tohto appka funguje, len sa tlačidlo nezobrazí. Kód si stav zisťuje sám
(`lib/auth/providers.ts`), takže v deň zapnutia sa tlačidlo objaví bez zásahu
do kódu a bez nasadzovania.

### a) Google Cloud Console (toto sa z repa spraviť nedá)

1. **APIs & Services → OAuth consent screen** — typ _External_, názov appky,
   kontaktný e-mail, doména.
2. **Credentials → Create credentials → OAuth client ID** → _Web application_.
3. **Authorized redirect URIs** — presne táto adresa:

   ```
   https://oukooqfpxeunhdzndsid.supabase.co/auth/v1/callback
   ```

   ⚠️ Je to adresa **Supabase**, nie našej appky. Toto je najčastejšia chyba.

4. Skopírovať **Client ID** a **Client secret**.

### b) Repozitár

`[auth.external.google]` už v `config.toml` je a odkazuje na premenné
`SUPABASE_AUTH_GOOGLE_CLIENT_ID` a `SUPABASE_AUTH_GOOGLE_SECRET` — tajomstvo sa
teda do gitu nedostane. Stačí `enabled = true` v `[remotes.production]`,
nastaviť obe premenné v prostredí a `supabase config push`.

### Overenie

```bash
curl -s "https://oukooqfpxeunhdzndsid.supabase.co/auth/v1/authorize?provider=google"
```

Kým vracia `{"msg":"Unsupported provider: provider is not enabled"}`, zapnuté to
nie je. Po zapnutí odpovie presmerovaním na `accounts.google.com`.

---

## 4. Ochrana proti prezradeným heslám — platená funkcia

Supabase advisor hlási `auth_leaked_password_protection` ako vypnutú. Nie je to
zabudnutý prepínač: pokus zapnúť ju cez Management API vráti
**402 Payment Required**. Kontrola hesla voči HaveIBeenPwned je na pláne **Pro**.

Kým je projekt na free tieri, ostáva vypnutá a advisor bude svietiť. Nič sa tým
nekazí — je to len chýbajúca vrstva navyše. Pri prechode na Pro sa zapne
jedným PATCH-om.

---

## Čo v config.toml vyzerá ako zmena, ale je ochrana

Tri hodnoty v `[remotes.production]` **nič nemenia** — sú tam preto, aby
`config push` nezhodil to, čo na produkcii už je. Hodnoty v hlavnom `[auth]`
bloku sú nastavené pre pohodlný lokálny vývoj a naostro by boli krok späť:

|                 | lokálne | produkcia | čo by sa stalo bez ochrany        |
| --------------- | ------- | --------- | --------------------------------- |
| `max_frequency` | 1 s     | 60 s      | adresa sa dá zaplaviť e-mailami   |
| `otp_length`    | 6       | 8         | kratší kód sa ľahšie uhádne       |
| MFA TOTP        | vypnuté | zapnuté   | zhodilo by dvojfaktorové overenie |

Pri každom ďalšom `config push` si tú tabuľku prejdi. `config push` posiela
**celý** `[auth]` blok, nie iba to, čo si zmenil.

---

## Čo rieši kód (hotové)

- **Tlačidlo Google sa nezobrazí**, kým provider nie je zapnutý — namiesto toho,
  aby viedlo na surový JSON od Supabase.
- **Prihlásenie rozlišuje nepotvrdený účet od zlého hesla.** Predtým sa každé
  odmietnutie ohlásilo ako „Nesprávny e-mail alebo heslo." a človek dokola
  skúšal heslo, ktoré mal správne.
- **Potvrdenie sa dá poslať znova** — z prihlásenia aj zo stránky po registrácii.
  Rada „skús registráciu znova" bola zlá: druhý pokus na tú istú adresu skončí
  hláškou, že používateľ už existuje.
- **Strop odosielania má vlastnú hlášku** namiesto anglickej technickej.
