# Architecture Decision Records

Prečo je kód taký, aký je. Čítaj **predtým**, než zmeníš zabehnutý pattern.

Nové ADR: `/adr <rozhodnutie>`. Šablóna: [`TEMPLATE.md`](./TEMPLATE.md).

| #                                               | Rozhodnutie                                    | Status   | Dátum      |
| ----------------------------------------------- | ---------------------------------------------- | -------- | ---------- |
| [0001](./0001-record-architecture-decisions.md) | Zapisujeme architektonické rozhodnutia ako ADR | Accepted | 2026-08-08 |

<!--
Po spustení /map-codebase sem pribudnú retroaktívne ADR pre rozhodnutia, ktoré sú už v kóde:
peniaze ako Decimal, tenancy stratégia, číslovanie faktúr, PDF pipeline, tvar Peppol integrácie.
Označ ich `Status: Accepted (retroactive)`.
-->

## Zdravie ADR

Sledujeme len tri veci, raz za kvartál:

- **pokrytie** — má väčšina rozhodnutí na kritickej ceste svoje ADR? Pod ~40 % je to len divadlo.
- **supersession rate** — ak za rok nič nenahradíme, znamená to, že rozhodnutia nezapisujeme, nie
  že sme ich trafili všetky.
- **či ich agent naozaj cituje** — keď Claude pri plánovaní odkáže na ADR číslom, systém funguje.
  Keď nikdy, sú buď príliš dlhé, alebo zle pomenované.
