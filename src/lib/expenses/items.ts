import { computeInvoice } from "@/lib/vat/engine"

/**
 * Položky nákladu — dodávateľská faktúra s viacerými sadzbami DPH.
 *
 * Doteraz mal náklad JEDNU sumu a JEDNU sadzbu, takže faktúra s 23 % aj 19 %
 * sa nedala zadať správne: buď sa rozdelila na dva náklady (a prestala sedieť
 * s dokladom), alebo sa celá zaúčtovala jednou sadzbou (a nesedela DPH).
 *
 * Prepočet ZÁMERNE neduplikuje logiku — používa `computeInvoice`, ten istý
 * otestovaný engine ako doklady. Zaokrúhľovanie po riadkoch a rekapitulácia
 * podľa sadzby tak sedia na oboch stranách účtovníctva.
 *
 * Režim je vždy `payer`: na prijatom doklade je sadzba tá, ktorú tam napísal
 * dodávateľ. Vlastný režim DPH odberateľa do toho nevstupuje — keď dodávateľ
 * DPH neúčtoval, má na položke nulovú sadzbu.
 */

export interface ExpenseItemInput {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
  /** Uctovne clenenie — do exportu pre uctovnika. */
  accountCode?: string | null
  costCenter?: string | null
  projectCode?: string | null
  activityCode?: string | null
}

export interface ExpenseItemRow {
  position: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  vat_rate: number
  line_base: number
  line_vat: number
  line_total: number
  account_code: string | null
  cost_center: string | null
  project_code: string | null
  activity_code: string | null
}

export interface ExpenseAmounts {
  subtotal: number
  vat_total: number
  total: number
  /** Rekapitulácia podľa sadzby — do `expenses.vat_rate_breakdown`. */
  vat_rate_breakdown: { rate: number; base: number; vat: number }[]
  /** Riadky pripravené na zápis do `expense_items`. */
  items: ExpenseItemRow[]
}

export function computeExpenseItems(
  items: ExpenseItemInput[],
): ExpenseAmounts {
  const totals = computeInvoice(
    items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
    })),
    "payer",
  )

  return {
    subtotal: totals.subtotal,
    vat_total: totals.vatTotal,
    total: totals.total,
    vat_rate_breakdown: totals.recap.map((r) => ({
      rate: r.rate,
      base: r.base,
      vat: r.vat,
    })),
    items: totals.lines.map((line, idx) => ({
      position: idx,
      description: items[idx].description,
      quantity: line.quantity,
      unit: items[idx].unit,
      unit_price: line.unitPrice,
      vat_rate: line.effectiveVatRate,
      line_base: line.lineBase,
      line_vat: line.lineVat,
      line_total: line.lineTotal,
      // Prazdne pole ide ako `null`, nie ako prazdny retazec — export by inak
      // posielal stlpec, ktory vyzera vyplneny, ale nic nenesie.
      account_code: items[idx].accountCode || null,
      cost_center: items[idx].costCenter || null,
      project_code: items[idx].projectCode || null,
      activity_code: items[idx].activityCode || null,
    })),
  }
}
