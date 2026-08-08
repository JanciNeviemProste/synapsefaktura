# Ako prebieha jedna relácia

Spoločné pre oboch. Kto čo vlastní, je v [`.github/CODEOWNERS`](../.github/CODEOWNERS);
osobné hranice sú v [`docs/agent/`](agent/). Tento súbor je o postupe — od
otvorenia terminálu po zavretie PR.

Mení sa cez pull request ako čokoľvek iné. Keď ti niektoré pravidlo prekáža,
otvor issue — netreba ho obchádzať potichu.

## 1. Začiatok — nikdy nezačínaj naslepo

```bash
git checkout main && git pull
gh issue list --assignee @me      # ber zhora
```

Prečítaj `docs/STATUS.md` (dve minúty, ušetria hodinu) a posledné dva súbory
v `docs/log/`. Zistíš z toho, čo druhý práve dorobil.

**Bez issue sa nezačína.** Je to jediná ochrana pred tým, aby sme dvaja robili
to isté. Ak fronta nie je prázdna a ty chceš robiť niečo iné, napíš to do issue
a počkaj na odpoveď.

```bash
git checkout -b feat/42-import-vypisov   # <typ>/<číslo issue>-<slug>
```

Typ je `feat`, `fix`, `docs`, `refactor` alebo `chore`. Vetvi **z `main`**, nie
z inej vetvy.

## 2. Počas práce

- **Jedna téma na jeden PR.** Orientačne do 500 riadkov diffu. Keď zistíš, že
  narastá, rozdeľ to — druhý PR počká.
- **Zostaň na svojom území.** Ak potrebuješ zmenu v súbore, ktorý podľa
  `CODEOWNERS` patrí druhému, sprav ju čo najmenšiu a **napíš to v popise PR**.
  Prepisovať cudzí kód bez dohovoru je najrýchlejšia cesta ku konfliktu.
- **`CLAUDE.md` nie je zápisník.** Nedopisuj doň priebeh práce. Patrí doň len
  trvalý kontext, a mení sa zriedka.
- **Nový súbor nekoliduje, spoločný áno.** Kedykoľvek máš na výber, píš do
  vlastného nového súboru.

## 3. Databáza

- Vývoj beží **len proti lokálnemu Supabase**: `pnpm db:start`, `pnpm db:reset`.
- Migrácia = **vždy nový súbor** `supabase/migrations/<timestamp>_<slug>.sql`.
  Existujúcu migráciu nikdy nemeň — už ju má druhý aplikovanú.
- **Každá nová verejná tabuľka musí mať RLS.** CI job `migrations` to kontroluje
  a bez toho PR neprejde.
- Do produkčnej databázy píše **len vlastník repa**, `supabase db push` až po
  merge.

## 4. Brána pred pull requestom

Všetkých päť musí prejsť. Bez výnimky, aj keď je zmena „len kozmetická".

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Ak niečo padne, oprav to **predtým**, než otvoríš PR. CI to zopakuje, takže
poslaním neopraveného kódu si len predĺžiš cestu.

## 5. Pull request

Vyplň šablónu, ktorá vyskočí. Do popisu patrí `Closes #42`, aby sa issue zavrelo
samo. Bez vyplneného „ako to overiť" nemá recenzent čo spustiť.

Čo sa deje ďalej:

- Musí zosvietiť **`verify` aj `migrations`**.
- PR potrebuje **jedno schválenie**. Vlastný PR si odkývnuť nemôžeš — GitHub to
  nedovolí a je to tak zámerne.
- Recenzia nie je hodnotenie človeka. Keď je pripomienka mimo, napíš prečo.

## 6. Koniec relácie

Napíš záznam do denníka — **vlastný nový súbor**:

```
docs/log/2026-08-08-import-bankovych-vypisov.md
```

Do cudzieho súboru v `docs/log/` **nikdy nedopisuj**. Práve preto sme denník
rozbili na samostatné súbory: nový súbor sa nedá dostať do konfliktu, spoločný
áno.

Kto mergoval na `main` ako posledný, prepíše `docs/STATUS.md`. **Celý** —
nedopisuje pod seba, inak sa vráti ten istý konflikt.

Zásadné rozhodnutie (vybrali sme knižnicu X, zamietli Y) patrí do
`docs/DECISIONS.md`, nie do denníka.

## 7. Čo nikdy

- **Push priamo na `main`.** Ruleset to odmietne, ale ani sa o to nepokúšaj.
- **Zásah do produkčnej databázy** kýmkoľvek okrem vlastníka.
- **`.env` čítať, písať, logovať ani commitovať.** Repo je verejné.
- **Zmena v sekcii „NEDOTÝKAŤ SA"** v `CLAUDE.md` bez testu a bez dôvodu v PR.
- **Zrušiť alebo prekopať funkciu bez opýtania.** To je produktové rozhodnutie,
  patrí vlastníkovi. Otvor issue.
- **Pridať závislosť**, keď to vie štandardná knižnica alebo niečo, čo už v
  projekte je.

## Rýchla tabuľka

| Situácia                        | Čo spraviť                                  |
| ------------------------------- | ------------------------------------------- |
| Fronta issues je prázdna        | Napíš vlastníkovi. Nevymýšľaj si prácu.     |
| Našiel som bug mimo svojej témy | Otvor issue. Neopravuj to v tomto PR.       |
| Potrebujem cudzí súbor          | Minimálna zmena + vysvetlenie v popise PR.  |
| PR narástol nad 500 riadkov     | Rozdeľ. Väčší PR nikto poriadne neprečíta.  |
| Neviem, či to smiem rozhodnúť   | Nesmieš. Opýtaj sa v issue.                 |
| CI padá a neviem prečo          | Napíš to do PR. Nemerguj cez to.            |
