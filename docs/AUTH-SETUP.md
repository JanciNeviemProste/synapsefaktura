# Prihlásenie a registrácia — čo treba nastaviť v Supabase

Kód je hotový, ale **tri veci sa nedajú nastaviť z repozitára** — žijú
v nastavení projektu Supabase a musí ich zapnúť vlastník projektu.

Stav zistený **2026-08-05** priamo z API produkčného projektu
(`oukooqfpxeunhdzndsid`):

| | stav | dôsledok |
|---|---|---|
| Site URL | `http://localhost:3000` | odkaz z e-mailu vedie na localhost → registráciu nejde dokončiť |
| Povolené presmerovania | produkčný callback **chýba** | to isté, plus obnova hesla a Google |
| Google provider | **vypnutý** | tlačidlo viedlo na bielu stránku so surovým JSON-om |

---

## 1. Site URL a povolené presmerovania (kritické)

**Supabase Dashboard → Authentication → URL Configuration**

- **Site URL:** `https://synapsefaktura.vercel.app`
- **Redirect URLs** (pridať oba riadky):
  - `https://synapsefaktura.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` — nech funguje aj lokálny vývoj

### Ako sa to overí

```
curl -s -o /dev/null -w "%{redirect_url}\n" \
  "https://oukooqfpxeunhdzndsid.supabase.co/auth/v1/verify?token=neplatny&type=signup&redirect_to=https://synapsefaktura.vercel.app/auth/callback"
```

Správne je, keď adresa v odpovedi **začína `https://synapsefaktura.vercel.app`**.
Kým tam bude `http://localhost:3000`, nastavenie ešte nesedí — GoTrue
nepovolené presmerovanie ticho nahradí Site URL, chybu nehlási.

---

## 2. Odosielanie e-mailov (kritické)

**Supabase Dashboard → Project Settings → Authentication → SMTP Settings**

Vstavané odosielanie Supabase je len na skúšanie: má strop **2 e-maily za
hodinu** a doručuje **iba na adresy členov projektu**. Registrácia z cudzej
adresy tak vytvorí účet, ale potvrdenie nikdy nepríde — presne to sa stalo
účtu z domény `chronoseducation.sk` (vytvorený 09:47, potvrdenie neprišlo).

Keďže appka už používa **Resend** na posielanie faktúr, tie isté údaje sa dajú
použiť aj sem:

| pole | hodnota |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| User | `resend` |
| Password | `RESEND_API_KEY` (ten istý, čo má appka vo Vercel) |
| Sender email | adresa na overenej doméne v Resende |

Bez overenej domény v Resende sa dá posielať len na vlastnú adresu — na
skutočných zákazníkov teda treba doménu v Resende overiť.

### Alternatíva, ak e-maily zatiaľ netreba

**Authentication → Providers → Email → Confirm email = OFF**

Účet potom funguje hneď po registrácii. **Na ostrú prevádzku to nie je
vhodné** — ktokoľvek sa zaregistruje na cudziu adresu.

---

## 3. Prihlásenie cez Google (nekritické)

Bez tohto appka funguje, len sa tlačidlo nezobrazí — kód si stav zisťuje sám
(`lib/auth/providers.ts`) a v deň, keď sa provider zapne, sa tlačidlo objaví
bez zásahu do kódu.

### a) Google Cloud Console

1. **APIs & Services → OAuth consent screen** — typ *External*, vyplniť názov
   appky, kontaktný e-mail a doménu.
2. **Credentials → Create credentials → OAuth client ID** → *Web application*.
3. **Authorized redirect URIs** — presne táto adresa:
   ```
   https://oukooqfpxeunhdzndsid.supabase.co/auth/v1/callback
   ```
   ⚠️ Je to adresa **Supabase**, nie našej appky. Toto je najčastejšia chyba
   pri zapájaní Google prihlásenia.
4. Skopírovať **Client ID** a **Client secret**.

### b) Supabase

**Authentication → Providers → Google** → zapnúť, vložiť Client ID a Secret.

### Ako sa to overí

```
curl -s "https://oukooqfpxeunhdzndsid.supabase.co/auth/v1/authorize?provider=google"
```

Kým vracia `{"msg":"Unsupported provider: provider is not enabled"}`, provider
zapnutý nie je. Po zapnutí odpovie presmerovaním na `accounts.google.com`.

---

## Čo rieši kód (už hotové)

- **Tlačidlo Google sa nezobrazí**, kým provider nie je zapnutý — namiesto
  toho, aby viedlo na surový JSON od Supabase.
- **Prihlásenie rozlišuje nepotvrdený účet od zlého hesla.** Predtým sa každé
  odmietnutie ohlásilo ako „Nesprávny e-mail alebo heslo." a človek dokola
  skúšal heslo, ktoré mal správne.
- **Potvrdenie sa dá poslať znova** — z prihlásenia aj zo stránky po
  registrácii. Rada „skús registráciu znova" bola zlá: druhý pokus na tú istú
  adresu skončí hláškou, že používateľ už existuje.
- **Strop odosielania má vlastnú hlášku** namiesto anglickej technickej.

## Čo tým NIE JE vyriešené

Kým sa nenastaví bod 1 a 2, **nový používateľ sa nezaregistruje** — účet
vznikne, ale potvrdiť sa nedá. Kód to vie povedať zrozumiteľne, doručiť
e-mail za Supabase nie.
