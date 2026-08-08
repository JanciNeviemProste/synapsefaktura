## Čo a prečo

<!-- Jeden odstavec. Čo vie používateľ po tejto zmene, čo predtým nevedel. Nie ako je to spravené. -->

Closes #

## Ako to otestovať

1.

## Dôkaz

<!-- Skutočný výstup, nie tvrdenie. pnpm typecheck && pnpm lint && pnpm test && pnpm build -->

```

```

## Kontrolný zoznam

- [ ] Spustil som `/ship` — nie som prvý človek, ktorý tento diff číta
- [ ] ≤5 súborov a ≤300 riadkov (ak nie, dole je napísané prečo)
- [ ] Všetky zmenené súbory sú v mojej lane podľa `docs/OWNERSHIP.md`
- [ ] Shared zone (`src/components/ui/`, `src/lib/validation/`, `src/lib/ai/`, `package.json`) — nedotknuté,
      alebo v samostatnej PR, ktorá už je zmergovaná
- [ ] Nový pattern / závislosť / hranica modulu → **ADR je v tejto PR**
- [ ] Nové správanie má test, ktorý predtým padal
- [ ] Žiadne nové `as any`, `@ts-ignore`, `eslint-disable`, prázdne `catch {}`
- [ ] Testy som neupravoval preto, aby prešiel kód
- [ ] Peniaze sú `Decimal`, dotazy sú tenant-scoped (ak sa toho týka)
- [ ] Peppol / UBL výstup validovaný, výstup validátora vyššie (ak sa toho týka)

## Lane

Lane: <!-- A / B --> · súborov: <!-- n --> · riadkov: <!-- n --> · shared zone: <!-- nie / ktoré -->

## Riziko

<!-- Čo sa pokazí, ak je toto zle, a ako to vrátime späť. „Žiadne" je platná odpoveď, ak je pravdivá. -->

## Všimol som si, neopravoval som

<!-- Veci mimo rozsahu, ktoré stoja za samostatnú issue. Sem, nie do tohto diffu. -->

-
