import { describe, it, expect } from "vitest"
import { docLabels } from "./doc-labels"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "./labels"

const TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]

describe("docLabels", () => {
  it("vráti slovenský slovník pre neznámy alebo chýbajúci jazyk", () => {
    expect(docLabels(null).documentTypes.quote).toBe("Cenová ponuka")
    expect(docLabels("de").documentTypes.quote).toBe("Cenová ponuka")
    expect(docLabels("EN").documentTypes.quote).toBe("Quotation")
  })

  it("každý jazyk pozná názvy všetkých typov dokladov", () => {
    for (const lang of ["sk", "cz", "en"]) {
      const L = docLabels(lang)
      for (const type of TYPES) {
        expect(L.documentTypes[type], `${lang}/${type}`).toBeTruthy()
      }
    }
  })

  it("názvy typov sa medzi jazykmi odlišujú (nie sú kópia slovenčiny)", () => {
    expect(docLabels("en").documentTypes.invoice).toBe("Invoice")
    expect(docLabels("cz").documentTypes.quote).toBe("Cenová nabídka")
  })
})
