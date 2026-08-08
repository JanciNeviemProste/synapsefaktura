# 0001. Zapisujeme architektonické rozhodnutia ako ADR

- **Status:** Accepted
- **Dátum:** 2026-08-08
- **Autori:** @JanciNeviemProste, @csrom

## Kontext

Na projekte pracujú dvaja vývojári a obaja používajú Claude Code ako primárny spôsob písania kódu.
Agent číta kód, ale nečíta dôvody — tie doteraz existovali len v hlave toho, kto rozhodnutie urobil.

Praktický dôsledok: agent narazí na návrh, ktorý vyzerá zbytočne zložito (lebo obchádza konkrétny
problém, o ktorom nevie), zjednoduší ho, a vráti späť chybu, ktorej sa pôvodný návrh vedome vyhýbal.
Každá jednotlivá PR pritom vyzerá rozumne. To je celý mechanizmus — architektúra neodtečie jedným
zlým rozhodnutím, ale sériou dobrých, ktorým chýba kontext.

Pri dvoch ľuďoch to nemá kto zachytiť: nie je tu tretí reviewer, ktorý si pamätá prečo.

## Rozhodnutie

Každé rozhodnutie, ktoré zavádza nový pattern, novú závislosť, novú hranicu modulu alebo ruší
predchádzajúcu konvenciu, dostane ADR v `docs/adr/NNNN-nazov.md`.

**ADR ide v tej istej PR ako zmena, ktorú popisuje.** Nie ako follow-up. PR bez ADR sa v review
vracia. Žiadna výnimka pre malé zmeny — malé zmeny sú presne to, ako sa drift nazbiera.

ADR sa nikdy nemažú. Zamietnuté rozhodnutie sa označí `Superseded by NNNN` a zostáva — cesta,
ktorou sme nešli, je informácia.

## Dôsledky

**Ľahšie:** agent si pri plánovaní vytiahne `docs/adr/` a berie ich ako obmedzenia, nie ako návrhy —
z generátora kódu sa stáva plánovač, ktorý rešpektuje predchádzajúce záväzky. Onboarding tretieho
človeka prestáva byť archeológia. Pri spore máme písomný záznam, nie dve spomienky.

**Ťažšie:** každá PR s novým patternom stojí navyše ~10 minút. Treba to reálne vynucovať v review,
inak to za dva týždne odumrie.

## Zvažované alternatívy

- **Písať dôvody do komentárov v kóde** — komentár prežije refaktor len náhodou a nedá sa nájsť,
  kým človek netrafí presne ten súbor.
- **Písať to do `CLAUDE.md`** — `CLAUDE.md` sa načítava celý pri každej session. Rozhodnutia by ho
  nafúkli a rozriedili inštrukcie, ktoré tam naozaj musia byť. ADR sa načítavajú na požiadanie.
- **Nezapisovať nič** — pri dvoch ľuďoch to nejaký čas funguje. Prestane fungovať presne vtedy, keď
  jeden z nás mesiac nesiahne na cudziu oblasť.

## Súvisiace

- `docs/WORKFLOW.md`
- `.claude/skills/adr/SKILL.md`
