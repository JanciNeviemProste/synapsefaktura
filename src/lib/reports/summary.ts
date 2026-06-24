import { round2 } from "@/lib/money"

/**
 * Period financial summary (income / expenses / cash-flow / profit / VAT).
 * Pure — the page fetches the rows; this computes the totals.
 */

export interface SummaryInvoice {
  status: string
  subtotal: number
  vat_total: number
  total: number
  paid_amount: number
}

export interface SummaryExpense {
  subtotal: number
  vat_total: number
  total: number
  paid_amount: number
  tax_deductible: boolean
}

export interface FinancialSummary {
  incomeBase: number
  incomeVat: number
  incomeTotal: number
  expenseBase: number
  expenseVat: number // deductible VAT only
  expenseTotal: number
  profit: number // income base − expense base
  vatLiability: number // collected − deductible
  cashIn: number
  cashOut: number
  cashFlow: number
}

export function computeSummary(
  invoices: SummaryInvoice[],
  expenses: SummaryExpense[],
): FinancialSummary {
  const issued = invoices.filter((i) => i.status !== "draft")

  const incomeBase = round2(issued.reduce((s, i) => s + i.subtotal, 0))
  const incomeVat = round2(issued.reduce((s, i) => s + i.vat_total, 0))
  const incomeTotal = round2(issued.reduce((s, i) => s + i.total, 0))

  const expenseBase = round2(expenses.reduce((s, e) => s + e.subtotal, 0))
  const expenseVat = round2(
    expenses
      .filter((e) => e.tax_deductible)
      .reduce((s, e) => s + e.vat_total, 0),
  )
  const expenseTotal = round2(expenses.reduce((s, e) => s + e.total, 0))

  const cashIn = round2(issued.reduce((s, i) => s + i.paid_amount, 0))
  const cashOut = round2(expenses.reduce((s, e) => s + e.paid_amount, 0))

  return {
    incomeBase,
    incomeVat,
    incomeTotal,
    expenseBase,
    expenseVat,
    expenseTotal,
    profit: round2(incomeBase - expenseBase),
    vatLiability: round2(incomeVat - expenseVat),
    cashIn,
    cashOut,
    cashFlow: round2(cashIn - cashOut),
  }
}
