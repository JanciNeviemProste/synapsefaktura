import type {
  UblInvoiceModel,
  ValidationError,
  ValidationResult,
} from "./types"

/**
 * Pre-send validation against EN 16931 business rules + Peppol BIS 3.0 + SK
 * customizations (§5.5 / §8). Pure function, no I/O.
 *
 * NOTE: The FULL Slovak schematron (Finančná správa SK Solution Architecture)
 * is NOT yet implemented here — only a representative subset of the high-value
 * EN 16931 / Peppol BIS rules plus a couple of SK-specific heuristics. The
 * complete SK schematron must still be wired in before production go-live.
 */

/** Two amounts are considered equal within the EN 16931 rounding tolerance. */
function eq(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.011
}

export function validateUbl(model: UblInvoiceModel): ValidationResult {
  const errors: ValidationError[] = []

  const err = (
    rule: string,
    message: string,
    location?: string,
  ): void => {
    errors.push({ rule, severity: "error", message, location })
  }
  const warn = (
    rule: string,
    message: string,
    location?: string,
  ): void => {
    errors.push({ rule, severity: "warning", message, location })
  }

  // BR-01 ProfileID — model is always BIS, not separately modeled. Skip (info).

  // BR-02 Invoice number (BT-1)
  if (!model.number || model.number.trim() === "") {
    err("BR-02", "Faktúra musí mať číslo faktúry.", "/Invoice/ID")
  }

  // BR-03 Issue date (BT-2)
  if (!model.issueDate || model.issueDate.trim() === "") {
    err("BR-03", "Faktúra musí mať dátum vystavenia.", "/Invoice/IssueDate")
  }

  // BR-04 Invoice type code — we always use 380; assert currency present instead.
  // BR-05 Invoice currency code (BT-5)
  if (!model.currency || model.currency.trim() === "") {
    err(
      "BR-05",
      "Faktúra musí mať kód meny.",
      "/Invoice/DocumentCurrencyCode",
    )
  }

  // BR-06 Seller name (BT-27)
  if (!model.seller?.name || model.seller.name.trim() === "") {
    err(
      "BR-06",
      "Dodávateľ musí mať uvedený názov.",
      "/Invoice/AccountingSupplierParty",
    )
  }

  // BR-07 Buyer name (BT-44)
  if (!model.buyer?.name || model.buyer.name.trim() === "") {
    err(
      "BR-07",
      "Odberateľ musí mať uvedený názov.",
      "/Invoice/AccountingCustomerParty",
    )
  }

  // BR-08 Seller postal address — at least country code (BT-40)
  if (!model.seller?.country || model.seller.country.trim() === "") {
    err(
      "BR-08",
      "Adresa dodávateľa musí obsahovať aspoň kód krajiny.",
      "/Invoice/AccountingSupplierParty/PostalAddress/Country",
    )
  }

  // BR-10 Buyer postal address — at least country code (BT-55)
  if (!model.buyer?.country || model.buyer.country.trim() === "") {
    err(
      "BR-10",
      "Adresa odberateľa musí obsahovať aspoň kód krajiny.",
      "/Invoice/AccountingCustomerParty/PostalAddress/Country",
    )
  }

  // BR-16 At least one invoice line (BG-25)
  if (!Array.isArray(model.lines) || model.lines.length < 1) {
    err("BR-16", "Faktúra musí obsahovať aspoň jeden riadok.", "/Invoice")
  }

  // BR-CO-10 Sum of line net amounts == subtotal (BT-106)
  const lineSum = (model.lines ?? []).reduce(
    (acc, l) => acc + (l.lineNet ?? 0),
    0,
  )
  if (!eq(lineSum, model.subtotal)) {
    err(
      "BR-CO-10",
      `Súčet čistých súm riadkov (${lineSum.toFixed(2)}) sa nerovná medzisúčtu (${model.subtotal.toFixed(2)}).`,
      "/Invoice/LegalMonetaryTotal/LineExtensionAmount",
    )
  }

  // BR-CO-13 subtotal + vatTotal == total
  if (!eq(model.subtotal + model.vatTotal, model.total)) {
    err(
      "BR-CO-13",
      `Medzisúčet plus DPH (${(model.subtotal + model.vatTotal).toFixed(2)}) sa nerovná celkovej sume (${model.total.toFixed(2)}).`,
      "/Invoice/LegalMonetaryTotal",
    )
  }

  // BR-CO-15 total (TaxInclusiveAmount) == subtotal + vatTotal
  if (!eq(model.total, model.subtotal + model.vatTotal)) {
    err(
      "BR-CO-15",
      `Celková suma s DPH (${model.total.toFixed(2)}) sa nerovná medzisúčtu plus DPH (${(model.subtotal + model.vatTotal).toFixed(2)}).`,
      "/Invoice/LegalMonetaryTotal/TaxInclusiveAmount",
    )
  }

  // Tax subtotal coherence (BR-S-08 / BR-CO-17): vat == base * rate/100.
  for (let i = 0; i < (model.taxSubtotals ?? []).length; i++) {
    const ts = model.taxSubtotals[i]
    if (ts.rate === 0) continue
    const expected = (ts.base * ts.rate) / 100
    if (!eq(ts.vat, expected)) {
      err(
        "BR-CO-17",
        `Suma DPH (${ts.vat.toFixed(2)}) v rozpise sa nerovná základ × sadzba (${expected.toFixed(2)}).`,
        `/Invoice/TaxTotal/TaxSubtotal[${i + 1}]`,
      )
    }
  }

  // ── VAT-mode-specific rules ────────────────────────────────────────────────
  switch (model.vatMode) {
    case "payer": {
      // BR-CO-09 Seller VAT id (IČ DPH) required for standard-rated invoices.
      if (!model.seller?.vatId || model.seller.vatId.trim() === "") {
        err(
          "BR-CO-09",
          "Pri režime platiteľa DPH musí mať dodávateľ uvedené IČ DPH.",
          "/Invoice/AccountingSupplierParty/PartyTaxScheme",
        )
      }
      // BR-S-* Standard-rated (category S): every S line must have rate > 0.
      const sLines = (model.lines ?? []).filter((l) => l.taxCategory === "S")
      for (let i = 0; i < sLines.length; i++) {
        if (!(sLines[i].vatRate > 0)) {
          err(
            "BR-S-05",
            "Riadok so štandardnou sadzbou (kategória S) musí mať sadzbu DPH väčšiu ako 0.",
            `/Invoice/InvoiceLine[pos=${sLines[i].position}]`,
          )
        }
      }
      for (const ts of (model.taxSubtotals ?? []).filter(
        (t) => t.category === "S",
      )) {
        if (!(ts.rate > 0)) {
          err(
            "BR-S-06",
            "Rozpis DPH so štandardnou sadzbou (kategória S) musí mať sadzbu väčšiu ako 0.",
            "/Invoice/TaxTotal/TaxSubtotal",
          )
        }
      }
      break
    }

    case "reverse_charge_domestic": {
      // BR-AE-* Reverse charge (category AE): buyer VAT id required, VAT == 0.
      if (!model.buyer?.vatId || model.buyer.vatId.trim() === "") {
        err(
          "BR-AE-09",
          "Pri prenesení daňovej povinnosti musí mať odberateľ uvedené IČ DPH.",
          "/Invoice/AccountingCustomerParty/PartyTaxScheme",
        )
      }
      if (!eq(model.vatTotal, 0)) {
        err(
          "BR-AE-08",
          "Pri prenesení daňovej povinnosti musí byť celková suma DPH nulová.",
          "/Invoice/TaxTotal/TaxAmount",
        )
      }
      // We cannot inspect the free-text note reliably — warn only.
      warn(
        "BR-AE-NOTE",
        'Faktúra by mala obsahovať poznámku "prenesenie daňovej povinnosti".',
        "/Invoice/Note",
      )
      break
    }

    case "intra_eu_b2b": {
      // BR-IC-* Intra-community supply (category K): buyer VAT id, VAT == 0.
      if (!model.buyer?.vatId || model.buyer.vatId.trim() === "") {
        err(
          "BR-IC-09",
          "Pri intrakomunitárnom dodaní musí mať odberateľ uvedené IČ DPH.",
          "/Invoice/AccountingCustomerParty/PartyTaxScheme",
        )
      }
      if (!eq(model.vatTotal, 0)) {
        err(
          "BR-IC-08",
          "Pri intrakomunitárnom dodaní musí byť celková suma DPH nulová.",
          "/Invoice/TaxTotal/TaxAmount",
        )
      }
      break
    }

    case "export": {
      // Category G — export outside the EU: VAT == 0.
      if (!eq(model.vatTotal, 0)) {
        err(
          "BR-G-08",
          "Pri vývoze mimo EÚ musí byť celková suma DPH nulová.",
          "/Invoice/TaxTotal/TaxAmount",
        )
      }
      break
    }

    case "exempt": {
      // Category E — exempt from VAT: VAT == 0.
      if (!eq(model.vatTotal, 0)) {
        err(
          "BR-E-08",
          "Pri oslobodení od DPH musí byť celková suma DPH nulová.",
          "/Invoice/TaxTotal/TaxAmount",
        )
      }
      break
    }

    default: {
      // Non-payer / not-registered modes: warn if seller VAT id missing.
      if (!model.seller?.vatId || model.seller.vatId.trim() === "") {
        warn(
          "BR-CO-09",
          "Dodávateľ nemá uvedené IČ DPH (pri neplatiteľovi DPH je to v poriadku).",
          "/Invoice/AccountingSupplierParty/PartyTaxScheme",
        )
      }
    }
  }

  // Peppol BIS PEPPOL-EN16931-R010 (warning): buyer EndpointID needed for delivery.
  if (!model.buyer?.peppolId || model.buyer.peppolId.trim() === "") {
    warn(
      "PEPPOL-EN16931-R010",
      "Odberateľ by mal mať uvedený Peppol EndpointID, inak nie je faktúra doručiteľná.",
      "/Invoice/AccountingCustomerParty/EndpointID",
    )
  }

  // ── SK-specific ────────────────────────────────────────────────────────────
  // TODO: verify against official Finančná správa source (SK schematron /
  // SK Solution Architecture v1.2+).
  // SK-R001 (warning): for SK sellers the EndpointID scheme should be `0245:`.
  if (model.seller?.country === "SK") {
    const sid = model.seller?.peppolId ?? ""
    if (!sid.startsWith("0245:")) {
      warn(
        "SK-R001",
        "Pre slovenského dodávateľa by mal byť Peppol identifikátor v tvare schémy 0245: (IČO).",
        "/Invoice/AccountingSupplierParty/EndpointID",
      )
    }
  }

  return {
    valid: !errors.some((e) => e.severity === "error"),
    errors,
  }
}
