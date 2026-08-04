/**
 * Pokladna — ciste dopocty zostatku (bez I/O).
 *
 * `cash_register_items.amount` je vzdy kladna suma dokladu vratane DPH; smer
 * urcuje `direction` (`in` = prijmovy doklad, `out` = vydavkovy). Zostatok je
 * teda sucet prijmov minus sucet vydavkov. Logika zije tu, aby sa dala testovat
 * bez databazy a aby zoznam aj detail pokladne ratali to iste.
 */

import { round2 } from "@/lib/money"

export type CashDirection = "in" | "out"

/** Minimum, ktore na dopocet potrebujeme — riadok z DB ho splna. */
export type CashEntry = {
  direction: CashDirection
  amount: number
}

export type CashTotals = {
  /** Sucet prijmovych dokladov. */
  income: number
  /** Sucet vydavkovych dokladov (kladne cislo). */
  expense: number
  /** income − expense; moze byt zaporny, viz cashBalance. */
  balance: number
  /** Pocet dokladov, z ktorych sa ratalo. */
  count: number
}

/**
 * Sucty pokladne. Zaporne alebo neciselne `amount` ignorujeme — DB ma na sume
 * check `amount > 0`, takze taky riadok je chyba dat a nema ticho menit zostatok
 * opacnym smerom.
 */
export function cashTotals(items: readonly CashEntry[]): CashTotals {
  let income = 0
  let expense = 0
  let count = 0

  for (const item of items) {
    const amount = round2(item.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    if (item.direction === "in") income += amount
    else expense += amount
    count += 1
  }

  income = round2(income)
  expense = round2(expense)
  return { income, expense, balance: round2(income - expense), count }
}

/**
 * Zostatok pokladne. Prazdna pokladna ma nulu. Zaporny zostatok vraciame tak,
 * ako vysiel — v praxi znamena chybu (vydaje bez zaevidovaneho prijmu) a UI ho
 * ma ukazat, nie schovat orezanim na nulu.
 */
export function cashBalance(items: readonly CashEntry[]): number {
  return cashTotals(items).balance
}

/** Zostatky vsetkych pokladni naraz — mapa `cash_register_id` → zostatok. */
export function cashBalancesByRegister<
  T extends CashEntry & { cash_register_id: string },
>(items: readonly T[]): Record<string, number> {
  const grouped = new Map<string, CashEntry[]>()
  for (const item of items) {
    const bucket = grouped.get(item.cash_register_id)
    if (bucket) bucket.push(item)
    else grouped.set(item.cash_register_id, [item])
  }

  const out: Record<string, number> = {}
  for (const [id, bucket] of grouped) out[id] = cashBalance(bucket)
  return out
}
