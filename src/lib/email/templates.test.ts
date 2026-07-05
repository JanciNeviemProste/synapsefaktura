import { describe, it, expect } from "vitest"
import { invoiceEmail, reminderEmail } from "./templates"

describe("invoiceEmail", () => {
  const base = {
    docNumber: "2026001",
    supplierName: "Moja Firma s.r.o.",
    customerName: "Jan Novák",
    total: "120,00 €",
    dueDate: "15.07.2026",
  }

  it("renders a Slovak subject and body", () => {
    const { subject, html } = invoiceEmail({ lang: "sk", ...base })
    expect(subject).toBe("Faktúra 2026001 od Moja Firma s.r.o.")
    expect(html).toContain("Dobrý deň, Jan Novák,")
    expect(html).toContain("120,00 €")
    expect(html).toContain("15.07.2026")
    expect(html).toContain("2026001")
  })

  it("renders Czech and English variants", () => {
    expect(invoiceEmail({ lang: "cz", ...base }).subject).toBe(
      "Faktura 2026001 od Moja Firma s.r.o.",
    )
    expect(invoiceEmail({ lang: "en", ...base }).subject).toBe(
      "Invoice 2026001 from Moja Firma s.r.o.",
    )
  })

  it("falls back to Slovak for unknown languages", () => {
    expect(invoiceEmail({ lang: "de", ...base }).subject).toContain("Faktúra")
    expect(invoiceEmail({ lang: null, ...base }).subject).toContain("Faktúra")
  })

  it("greets without a name when the customer is missing", () => {
    const { html } = invoiceEmail({ lang: "sk", ...base, customerName: null })
    expect(html).toContain("Dobrý deň,")
    expect(html).not.toContain("Dobrý deň, ,")
  })

  it("escapes HTML in interpolated values", () => {
    const { html } = invoiceEmail({
      lang: "sk",
      ...base,
      supplierName: "A & B <script>",
    })
    expect(html).toContain("A &amp; B &lt;script&gt;")
    expect(html).not.toContain("<script>")
  })
})

describe("reminderEmail", () => {
  it("builds a subject and splits the body into paragraphs", () => {
    const { subject, html } = reminderEmail({
      lang: "sk",
      docNumber: "2026001",
      supplierName: "Moja Firma",
      body: "Prvý odsek.\n\nDruhý odsek.",
    })
    expect(subject).toBe("Upomienka k faktúre 2026001")
    expect(html).toContain("<p>Prvý odsek.</p>")
    expect(html).toContain("<p>Druhý odsek.</p>")
  })

  it("uses the English subject for en documents", () => {
    const { subject } = reminderEmail({
      lang: "en",
      docNumber: "2026001",
      supplierName: "My Co",
      body: "Please pay.",
    })
    expect(subject).toBe("Payment reminder for invoice 2026001")
  })
})
