# 2026-08-05: Biely text na bielom + teplá šedá paleta pre celý produkt

Roman: „text je inak neviditeľný na landing page biele pozadie biely text
akože dveci nech to je celé v takých šedých farbách a ten dizajn prenes aj do
vnútra nie len na landing".

⚠️ **`color` sa DEDÍ — a na tom to padlo.** `body` mal `text-foreground`, čo
bolo v tmavom režime takmer biela. Landing si cez `.landing-light` prepísal len
**premenné**, takže `bg-background` sa vyhodnotilo na bielu — ale nadpisy si
vlastnú farbu nenastavujú, takže zdedili tú bielu z `body`. **Prepis premennej
spätne nezmení už vypočítanú zdedenú hodnotu.** `.landing-light` bol nesprávny
nástroj; nameraná príčina, nie odhad: v tmavom režime `body color` =
`oklch(0.985 0 0)` na pozadí `oklch(1 0 0)`.

**Tmavý režim je preč a je to zámer.** Jedna paleta tú triedu chýb odstraňuje
úplne a video v hero je svetlé, takže tmavý režim k nemu nesadal. Odstránené:
`next-themes`, `ThemeProvider`, `ThemeToggle`, blok `.dark`, variant
`@custom-variant dark`, **50 výskytov `dark:`** v 14 súboroch a
`suppressHydrationWarning` (bol tam kvôli next-themes a ďalej by len schovával
skutočné rozdiely). Čistý úbytok −146 riadkov.

**Teplá šedá podľa videa:** pozadie `#edebe8`, karty `#f6f5f3`, text `#1c1b1a`,
slabší text `#6b6863`, linky `black/8 %`. Čistá biela ani čierna sa v palete
nevyskytujú — na svetlom videu pôsobili tvrdo. Karty sa odlišujú **svetlejším**
odtieňom, nie tmavším okolím, preto plocha obsahu už nemá `bg-muted/20`.

**Dizajn aj vo vnútri:** nadpisy všetkých 16 obrazoviek zjednotené na
`font-heading` (bol to jeden zdieľaný vzor `text-2xl font-semibold`, takže
jedna zmena); položky sidebaru sú **pilulky** ako tlačidlá — ten tvar drží
landing a vnútro pri sebe.

Overené, že appka nemá **ani jednu** natvrdo napísanú farbu mimo vývojového
`design-switcher`-a, takže sa paleta preberie naozaj všade. Po oprave sú obe
farebné schémy vizuálne identické (`rgb(28,27,26)` na `rgb(237,235,232)`).

**Čo NIE je prerobené:** rozloženie jednotlivých obrazoviek. Prebrali paletu,
typografiu aj tvary, ale tabuľky a formuláre zostávajú husto sadzané — vzdušný
