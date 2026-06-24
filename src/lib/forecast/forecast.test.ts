import { describe, expect, it } from "vitest"

import {
  computeForecast,
  paymentBehaviourOffset,
  type ComputeForecastInput,
  type PaidInvoiceSample,
} from "./forecast"

const TODAY = new Date("2026-06-01T00:00:00Z")

function emptyInput(): ComputeForecastInput {
  return { invoices: [], paidSamples: [], recurring: [], contacts: [] }
}

describe("paymentBehaviourOffset", () => {
  it("returns 0 when there is no history for the customer", () => {
    expect(paymentBehaviourOffset([], "c1")).toBe(0)
  })

  it("computes the median lateness in days", () => {
    const samples: PaidInvoiceSample[] = [
      // 10, 15, 20 days late → median 15
      { contactId: "c1", dueDate: "2026-01-01", paidAt: "2026-01-11" },
      { contactId: "c1", dueDate: "2026-02-01", paidAt: "2026-02-16" },
      { contactId: "c1", dueDate: "2026-03-01", paidAt: "2026-03-21" },
      // different customer must be ignored
      { contactId: "c2", dueDate: "2026-01-01", paidAt: "2026-06-01" },
    ]
    expect(paymentBehaviourOffset(samples, "c1")).toBe(15)
  })
})

describe("computeForecast", () => {
  it("empty input yields all-zero buckets and totals", () => {
    const r = computeForecast(emptyInput(), TODAY)
    expect(r.buckets).toEqual({ day30: 0, day60: 0, day90: 0 })
    expect(r.totalReceivables).toBe(0)
    expect(r.overdueTotal).toBe(0)
    expect(r.behaviour).toEqual([])
  })

  it("buckets outstanding by the raw due date when behaviour is unknown", () => {
    const input: ComputeForecastInput = {
      ...emptyInput(),
      contacts: [{ id: "c1", name: "Klient A" }],
      invoices: [
        // due in 10 days → 30/60/90
        { contactId: "c1", total: 100, paidAmount: 0, dueDate: "2026-06-11" },
        // due in 45 days → 60/90 only
        { contactId: "c1", total: 200, paidAmount: 50, dueDate: "2026-07-16" },
      ],
    }
    const r = computeForecast(input, TODAY)
    expect(r.buckets.day30).toBe(100)
    expect(r.buckets.day60).toBe(250) // 100 + 150 outstanding
    expect(r.buckets.day90).toBe(250)
    expect(r.totalReceivables).toBe(250)
  })

  it("shifts inflow later for a customer who pays ~15 days late", () => {
    // Invoice due in 20 days. With a +15d behaviour offset the expected pay
    // date lands at day 35 → moves out of the 30-day bucket into 60/90.
    const paidSamples: PaidInvoiceSample[] = [
      { contactId: "c1", dueDate: "2026-01-01", paidAt: "2026-01-16" },
      { contactId: "c1", dueDate: "2026-02-01", paidAt: "2026-02-16" },
    ]
    const input: ComputeForecastInput = {
      ...emptyInput(),
      contacts: [{ id: "c1", name: "Pomalý klient" }],
      paidSamples,
      invoices: [
        { contactId: "c1", total: 100, paidAmount: 0, dueDate: "2026-06-21" },
      ],
    }
    const r = computeForecast(input, TODAY)
    expect(r.buckets.day30).toBe(0)
    expect(r.buckets.day60).toBe(100)
    expect(r.buckets.day90).toBe(100)
    expect(r.behaviour).toEqual([
      {
        contactId: "c1",
        name: "Pomalý klient",
        offsetDays: 15,
        sampleCount: 2,
      },
    ])
  })

  it("counts past-due outstanding as overdue and still expects the inflow", () => {
    const input: ComputeForecastInput = {
      ...emptyInput(),
      invoices: [
        { contactId: null, total: 300, paidAmount: 0, dueDate: "2026-05-20" },
      ],
    }
    const r = computeForecast(input, TODAY)
    expect(r.overdueTotal).toBe(300)
    expect(r.buckets.day30).toBe(300) // past-due inflow falls into nearest bucket
  })

  it("includes active recurring invoices that run within the horizon", () => {
    const input: ComputeForecastInput = {
      ...emptyInput(),
      recurring: [
        { contactId: "c1", nextRunAt: "2026-06-15", amount: 500 }, // in horizon
        { contactId: "c1", nextRunAt: "2026-10-01", amount: 999 }, // beyond 90d
        { contactId: "c1", nextRunAt: "2026-06-20", amount: null }, // no estimate
      ],
    }
    const r = computeForecast(input, TODAY)
    expect(r.buckets.day30).toBe(500)
    expect(r.buckets.day90).toBe(500)
  })
})
