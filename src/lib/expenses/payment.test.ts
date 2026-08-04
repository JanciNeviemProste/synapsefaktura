import { describe, it, expect } from "vitest"
import {
  addExpensePayment,
  expensePaymentStatus,
  remainingToPay,
} from "./payment"

describe("expensePaymentStatus", () => {
  it("nula je nezaplatene", () => {
    expect(expensePaymentStatus(0, 100)).toBe("unpaid")
  })

  it("cast sumy je ciastocna uhrada", () => {
    expect(expensePaymentStatus(40, 100)).toBe("partially_paid")
    expect(expensePaymentStatus(99.99, 100)).toBe("partially_paid")
  })

  it("presna zhoda je uhradene", () => {
    expect(expensePaymentStatus(100, 100)).toBe("paid")
    expect(expensePaymentStatus(246.5, 246.5)).toBe("paid")
  })

  it("preplatok neodmietame — stav je uhradene", () => {
    expect(expensePaymentStatus(150, 100)).toBe("paid")
  })

  it("zaporna uhradena suma je nezaplatene", () => {
    expect(expensePaymentStatus(-5, 100)).toBe("unpaid")
  })

  it("nulovy doklad je uhradeny az ked nieco zaplatime", () => {
    expect(expensePaymentStatus(0, 0)).toBe("unpaid")
    expect(expensePaymentStatus(10, 0)).toBe("paid")
  })

  it("zaokruhluje na centy, aby haliere nedrzali doklad otvoreny", () => {
    expect(expensePaymentStatus(99.999, 100)).toBe("paid")
  })
})

describe("addExpensePayment", () => {
  it("pripocitava, neprepisuje", () => {
    expect(addExpensePayment(0, 50)).toBe(50)
    expect(addExpensePayment(50, 50)).toBe(100)
    expect(addExpensePayment(100, 20)).toBe(120)
  })

  it("zaokruhluje na centy", () => {
    expect(addExpensePayment(0.1, 0.2)).toBe(0.3)
  })

  it("zaporna oprava neklesne pod nulu", () => {
    expect(addExpensePayment(50, -80)).toBe(0)
    expect(addExpensePayment(50, -50)).toBe(0)
    expect(addExpensePayment(50, -20)).toBe(30)
  })
})

describe("remainingToPay", () => {
  it("vrati zvysok do plnej sumy", () => {
    expect(remainingToPay(30, 100)).toBe(70)
    expect(remainingToPay(0, 246)).toBe(246)
  })

  it("uhradene ani preplatene uz nic nedlzi", () => {
    expect(remainingToPay(100, 100)).toBe(0)
    expect(remainingToPay(150, 100)).toBe(0)
  })
})
