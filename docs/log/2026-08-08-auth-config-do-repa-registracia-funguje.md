# 2026-08-08: Auth config do repa, registrácia v produkcii funguje

Issue #28. Otázka znela, či sa `AUTH-SETUP.md` dá dokončiť cez Supabase MCP
konektor. **Nedá** — ten vie databázu, migrácie, logy, advisory a edge funkcie,
nástroj na Auth nastavenia v ňom nie je. Cesta viedla cez `supabase config push`.

## Stav pri nástupe nesedel s dokumentáciou

`AUTH-SETUP.md` popisoval meranie z 5. 8. Medzitým niekto Site URL zmenil, ale
zle. Zmerané sondami proti `/auth/v1/verify`:

|                           | očakávané podľa dokumentácie | skutočnosť                                      |
| ------------------------- | ---------------------------- | ----------------------------------------------- |
| Site URL                  | `http://localhost:3000`      | `http://synapsefaktura.vercel.app` — **`http`** |
| `https://…/auth/callback` | chýba                        | chýba (`http` variant tam bol)                  |

Dôsledok: potvrdzovací odkaz poslal človeka na koreň webu namiesto
`/auth/callback`. **Registrácia bola stále rozbitá, len inak**, než dokumentácia
tvrdila.

## Prečo config-as-code a nie dashboard

`supabase/config.toml` **už tie správne adresy obsahoval** (riadky 169–174),
vrátane poznámky, že sa musia poslať cez `config push`. Nikdy sa neposlali.
Presne toto je dôvod, prečo Auth nastavenie nemá žiť v dashboarde: nedalo sa
s ničím porovnať, takže si preklepu `http`/`https` nikto nevšimol.

Pribudol blok `[remotes.production]` — lokálny beh si drží svoje hodnoty,
produkcia dedí zvyšok.

## Kontrola pred pushom našla tri regresie

`config push` posiela **celý** `[auth]` blok, nie iba rozdiel. Porovnanie proti
skutočnému stavu produkcie (`GET /v1/projects/{ref}/config/auth`) ukázalo, že
by okrem zamýšľaných zmien potichu zhoršil tri veci:

|                          | produkcia | config.toml by poslal        |
| ------------------------ | --------- | ---------------------------- |
| `smtp_max_frequency`     | 60 s      | 1 s — adresa sa dá zaplaviť  |
| `mailer_otp_length`      | 8         | 6 — slabší kód               |
| `mfa_totp_enroll/verify` | zapnuté   | vypnuté — koniec dvojfaktoru |

Zachytené a prebité v `[remotes.production]`. Diff, ktorý `config push` nakoniec
vypísal, obsahoval len tri zamýšľané riadky.

## Čo sa zmenilo na produkcii

- `site_url` → `https://synapsefaktura.vercel.app`
- `additional_redirect_urls` → pribudol produkčný `/auth/callback`
- `enable_confirmations` → **false**, dočasne, rozhodnutie vlastníka

## Overené priechodom, nie domnienkou

Sondy: Site URL vracia `https://`, produkčný callback sa vracia presne tak, ako
bol poslaný, localhost naďalej funguje.

Skutočná registrácia cez `/auth/v1/signup`: účet vznikol a **rovno prišiel
prístupový token** — potvrdzovanie je naozaj vypnuté. Skúšobný účet
(`3146a45b…`) zmazaný z `auth.users`, riadok v `profiles` sa odstránil s ním.

## Otvorené

- **Potvrdzovanie e-mailom je vypnuté** → ktokoľvek sa vie zaregistrovať na
  cudziu adresu. Zapnutie späť potrebuje overenú doménu v Resende — issue #35.
- **Ochrana proti prezradeným heslám sa zapnúť nedá.** Nie je to zabudnutý
  prepínač: `PATCH` s `password_hibp_enabled` vracia **402 Payment Required**,
  je to funkcia plánu Pro. Advisor bude svietiť, kým je projekt na free tieri.
- **Google provider** ostáva vypnutý — `config.toml` je pripravený, chýba klient
  z Google Cloud Console.

## Poznámka pre budúcnosť

CLI bolo prihlásené pod cudzím účtom (`info@cybersociety.sk`), ktorý produkčný
projekt nevidí — prejavilo sa to ako `403` na nesúvisiacom endpointe, nie ako
zrozumiteľná hláška. Keď `config push` vráti 403, prvý krok je
`supabase projects list` a pozrieť sa, či je projekt vôbec v zozname.
