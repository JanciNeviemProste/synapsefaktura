import { round } from "@/lib/money"

/**
 * Skladovy stav zo zoznamu pohybov — CISTA logika, ziadne I/O.
 *
 * DOLEZITE: `products.stock_qty` je DENORMALIZOVANA hodnota. Zdrojom pravdy su
 * zaznamy v `stock_movements` — `stock_qty` je len ich dopocitatelny sucet,
 * drzany v tabulke preto, aby sa cennik nemusel pri kazdom vypise scitavat.
 * Kazdy zapis do `stock_movements` musi stav prepocitat tymito funkciami a az
 * potom prepisat `products.stock_qty`. Kto zmeni pohyby inou cestou a prepocet
 * vynecha, obe hodnoty rozide a uz sa neda zistit, ktora plati.
 */

/** Desatinne miesta mnozstva — `stock_movements.quantity` je numeric(14,3). */
export const STOCK_QTY_DECIMALS = 3

export const STOCK_MOVEMENT_TYPES = [
  "in",
  "out",
  "adjustment",
  "return",
] as const

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

/**
 * Minimum, ktore z riadku `stock_movements` na vypocet potrebujeme. Nazvy
 * stlpcov su zamerne snake_case, aby sa riadok z databazy dal poslat priamo,
 * bez medzikroku, ktory by sa mohol rozist so schemou.
 */
export type StockMovementEntry = {
  type: StockMovementType
  quantity: number | string | null
  moved_at?: string | null
  created_at?: string | null
}

/**
 * Mnozstvo pohybu ako kladne cislo. Postgres `numeric` moze prist aj ako
 * retazec; nepouzitelna hodnota (null, NaN) sa berie ako nula. Znamienko sa
 * ignoruje zamerne — smer urcuje `type` (DB ma check `quantity > 0`), takze
 * zaporne cislo je preklep v znamienku, nie opacny pohyb.
 */
function quantityOf(movement: StockMovementEntry): number {
  const raw =
    typeof movement.quantity === "string"
      ? Number(movement.quantity)
      : (movement.quantity ?? 0)
  return Number.isFinite(raw) ? Math.abs(raw) : 0
}

function timeOf(iso?: string | null): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Chronologicke poradie, najstarsie prve. Zalezi na nom: `adjustment` prepisuje
 * stav, takze v inom poradi vyjde iny vysledok. Pri zhodnom `moved_at`
 * rozhoduje `created_at`, nakoniec povodne poradie v poli (stabilne triedenie).
 */
export function sortStockMovements<T extends StockMovementEntry>(
  movements: ReadonlyArray<T>,
): T[] {
  return movements
    .map((movement, index) => ({ movement, index }))
    .sort((a, b) => {
      const byMoved = timeOf(a.movement.moved_at) - timeOf(b.movement.moved_at)
      if (byMoved !== 0) return byMoved
      const byCreated =
        timeOf(a.movement.created_at) - timeOf(b.movement.created_at)
      if (byCreated !== 0) return byCreated
      return a.index - b.index
    })
    .map((entry) => entry.movement)
}

/** Stav po jednom pohybe. Zaokruhluje sa po kazdom kroku, nie az na konci. */
export function applyStockMovement(
  balance: number,
  movement: StockMovementEntry,
): number {
  const qty = quantityOf(movement)
  switch (movement.type) {
    case "in":
      return round(balance + qty, STOCK_QTY_DECIMALS)
    case "return":
      // Vratka od odberatela vracia tovar spat na sklad, teda pripocitava.
      return round(balance + qty, STOCK_QTY_DECIMALS)
    case "out":
      return round(balance - qty, STOCK_QTY_DECIMALS)
    case "adjustment":
      // Inventura: `quantity` je zisteny SKUTOCNY stav, nie rozdiel oproti
      // evidencii. Preto doterajsi sucet prepise. Rozdiel to byt nemoze —
      // stlpec ma check `quantity > 0`, takze zapornu opravu by sa nedalo
      // zapisat a `adjustment` by splynul s `in`.
      return round(qty, STOCK_QTY_DECIMALS)
    default:
      // Neznamy typ (starsi zaznam, rozsirenie enumu) stav radsej nemeni.
      return balance
  }
}

/**
 * Stav skladu po vsetkych pohyboch. Bez pohybov je nula.
 *
 * Vysledok moze byt zaporny a je to zamer: znamena, ze sa vydalo viac, nez je
 * evidovane na sklade. Taku nezrovnalost chceme vidiet, nie ju orezat na nulu.
 */
export function stockBalance(
  movements: ReadonlyArray<StockMovementEntry>,
): number {
  return sortStockMovements(movements).reduce(
    (balance, movement) => applyStockMovement(balance, movement),
    0,
  )
}

/**
 * Pohyby v chronologickom poradi so stavom PO kazdom z nich — pre historiu
 * v UI, aby bolo vidiet, ako sa aktualny stav poskladal.
 */
export function stockBalanceHistory<T extends StockMovementEntry>(
  movements: ReadonlyArray<T>,
): Array<{ movement: T; balance: number }> {
  let balance = 0
  return sortStockMovements(movements).map((movement) => {
    balance = applyStockMovement(balance, movement)
    return { movement, balance }
  })
}
