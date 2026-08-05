# 2026-08-05: Prihlásenie — tri príčiny, dve mimo kódu

Roman: „prihlasovanie cez google nie je spojazdnene a realne sa mi teraz neda
ani zaregistrovat". Overené priamo proti produkčnému projektu.

- ⚠️ **Site URL projektu je stále `http://localhost:3000`** a produkčný callback
  nie je medzi povolenými presmerovaniami. Overené cez `/auth/v1/verify`:
  **všetky tri pokusy** skončili na localhoste — aj ten, kde bola produkčná
  adresa výslovne požadovaná, aj ten s cudzou doménou. GoTrue nepovolené
  presmerovanie **ticho nahradí** Site URL a chybu nehlási. Dôsledok: odkaz
  z potvrdzovacieho e-mailu vedie nikam, takže registráciu nejde dokončiť,
  hoci účet vznikne. To isté by zhodilo obnovu hesla aj Google.
- ⚠️ **Google provider nie je zapnutý.** Podstatné je, že
  `signInWithOAuth` poskytovateľa **neoveruje** — vždy vráti adresu a chybu
  ohlási až Supabase. Používateľ teda pristál na bielej stránke so surovým
  JSON-om. Tlačidlo sa teraz zobrazí len keď provider naozaj beží
  (`lib/auth/providers.ts`, živé `/auth/v1/settings`, cache 5 min) — objaví sa
  samo v deň, keď sa zapne.
- **Prihlásenie klamalo.** Každé odmietnutie sa ohlásilo ako „Nesprávny e-mail
  alebo heslo." Pri nepotvrdenom účte to bola nepravda, ktorá posielala človeka
  dokola skúšať heslo, ktoré má správne. Rozlíšené (`lib/auth/errors.ts`)
  a doplnená ponuka poslať potvrdenie znova.
- Stránka po registrácii radila „skús registráciu znova" — **zlá rada**: druhý
  pokus na tú istú adresu skončí hláškou, že používateľ už existuje.

**Zásah do produkcie:** Romanov účet z 09:47 potvrdený ručne
(`email_confirmed_at`) po jeho výslovnom súhlase — v transakcii s poistkou na
presne jeden riadok. `confirmed_at` je generovaný stĺpec, nesahá sa naň.

**Čaká na Romana** (nastavenia projektu, z repa sa nedajú meniť, Management API
token nie je): Site URL + zoznam presmerovaní, SMTP cez Resend, zapnutie
Google. Postup aj overovacie príkazy: `docs/AUTH-SETUP.md`.
