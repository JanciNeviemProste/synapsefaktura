import { isZeroVatMode } from "@/lib/vat/engine"
import { legalNoteForVatMode } from "@/lib/vat/legal-notes"
import { VAT_MODE_LABELS, type VatMode } from "@/lib/validation/org"
import type { Database } from "@/lib/supabase/database.types"

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type DocumentItemRow = Database["public"]["Tables"]["document_items"]["Row"]
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"]
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
type VatRateRow = Database["public"]["Tables"]["vat_rates"]["Row"]

export type ComplianceSeverity = "error" | "warning" | "info"

export interface ComplianceIssue {
  severity: ComplianceSeverity
  /** Human-readable Slovak description of the problem. */
  message: string
  /** Optional short one-liner on how to fix it. */
  fix?: string
}

export interface ComplianceInput {
  doc: DocumentRow
  items: DocumentItemRow[]
  org: OrganizationRow
  contact: ContactRow | null
  vatRates: VatRateRow[]
  /** Optional supplier IBAN (from bank_accounts). Empty/absent = missing. */
  iban?: string | null
}

export interface ComplianceResult {
  score: number
  issues: ComplianceIssue[]
}

/** Severity → penalty applied to the 0–100 compliance score. */
const PENALTY: Record<ComplianceSeverity, number> = {
  error: 25,
  warning: 8,
  info: 0,
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === ""
}

/** True if `rate` exists in `vat_rates` with a validity window covering `onDate`. */
function isRateValidOn(
  rate: number,
  onDate: string,
  vatRates: VatRateRow[],
): boolean {
  return vatRates.some((r) => {
    if (Math.abs(r.percent - rate) > 0.0001) return false
    if (r.valid_from > onDate) return false
    if (r.valid_to != null && r.valid_to <= onDate) return false
    return true
  })
}

/** VAT modes that require the buyer's IČ DPH and a specific legal note. */
const BUYER_VAT_ID_MODES: ReadonlySet<VatMode> = new Set<VatMode>([
  "reverse_charge_domestic",
  "intra_eu_b2b",
])

/**
 * Pure Slovak VAT/§74 compliance checker (§7.4). No AI, no I/O — deterministic so
 * it can be unit-tested and run without an AI key. Returns a 0–100 score and a
 * list of issues. Advisory only: never blocks issuing.
 */
export function checkCompliance(input: ComplianceInput): ComplianceResult {
  const { doc, items, org, contact, vatRates, iban } = input
  const issues: ComplianceIssue[] = []
  const mode = doc.vat_mode as VatMode

  // --- §74 mandatory supplier identification ---
  if (isBlank(org.ico)) {
    issues.push({
      severity: "error",
      message: "Chýba IČO dodávateľa.",
      fix: "Doplň IČO v nastaveniach firmy.",
    })
  }
  if (isBlank(org.dic)) {
    issues.push({
      severity: "error",
      message: "Chýba DIČ dodávateľa.",
      fix: "Doplň DIČ v nastaveniach firmy.",
    })
  }
  if (org.is_vat_payer && isBlank(org.ic_dph)) {
    issues.push({
      severity: "error",
      message: "Firma je platiteľ DPH, ale chýba IČ DPH dodávateľa.",
      fix: "Doplň IČ DPH v nastaveniach firmy.",
    })
  }

  // --- §74 mandatory customer identification ---
  if (doc.contact_id == null || contact == null || isBlank(contact.name)) {
    issues.push({
      severity: "error",
      message: "Chýba názov / identifikácia odberateľa.",
      fix: "Vyber alebo doplň odberateľa.",
    })
  }

  // --- §74 mandatory document header fields ---
  if (isBlank(doc.number)) {
    issues.push({
      severity: "error",
      message: "Chýba poradové číslo dokladu.",
      fix: "Prideľ dokladu poradové číslo.",
    })
  }
  if (isBlank(doc.issue_date)) {
    issues.push({
      severity: "error",
      message: "Chýba dátum vystavenia.",
      fix: "Doplň dátum vystavenia.",
    })
  }
  if (isBlank(doc.supply_date)) {
    issues.push({
      severity: "warning",
      message: "Chýba dátum dodania (DUZP).",
      fix: "Doplň dátum dodania tovaru/služby.",
    })
  }
  if (isBlank(doc.due_date)) {
    issues.push({
      severity: "warning",
      message: "Chýba dátum splatnosti.",
      fix: "Doplň dátum splatnosti.",
    })
  }
  if (isBlank(doc.currency)) {
    issues.push({
      severity: "error",
      message: "Chýba mena dokladu.",
      fix: "Nastav menu dokladu (napr. EUR).",
    })
  }

  // --- Payment details (IBAN) ---
  if (isBlank(iban)) {
    issues.push({
      severity: "warning",
      message: "Chýba IBAN pre platbu.",
      fix: "Pridaj bankový účet (IBAN) k firme.",
    })
  }

  // --- Line items ---
  if (items.length === 0) {
    issues.push({
      severity: "error",
      message: "Doklad neobsahuje žiadne položky.",
      fix: "Pridaj aspoň jednu položku.",
    })
  }

  const issueDate = doc.issue_date
  const zeroVat = isZeroVatMode(mode)

  items.forEach((item, idx) => {
    const label = `Položka ${idx + 1}`
    if (isBlank(item.description)) {
      issues.push({
        severity: "error",
        message: `${label}: chýba popis.`,
        fix: "Doplň popis položky.",
      })
    }
    if (!(item.quantity > 0)) {
      issues.push({
        severity: "error",
        message: `${label}: množstvo musí byť kladné.`,
        fix: "Zadaj množstvo väčšie ako 0.",
      })
    }
    if (isBlank(item.unit)) {
      issues.push({
        severity: "warning",
        message: `${label}: chýba merná jednotka.`,
        fix: "Doplň jednotku (ks, hod, ...).",
      })
    }

    // VAT rate validity — only meaningful when VAT is actually charged and we
    // have an issue date to validate against.
    if (!zeroVat && issueDate && vatRates.length > 0) {
      if (!isRateValidOn(item.vat_rate, issueDate, vatRates)) {
        issues.push({
          severity: "error",
          message: `${label}: sadzba DPH ${item.vat_rate} % neplatí k dátumu vystavenia (${issueDate}).`,
          fix: "Použi sadzbu platnú k dátumu vystavenia (23/19/5/0 % od 1.1.2025).",
        })
      }
    }
  })

  // --- VAT-mode specific rules ---
  if (BUYER_VAT_ID_MODES.has(mode) && isBlank(contact?.ic_dph)) {
    issues.push({
      severity: "error",
      message: `Režim „${VAT_MODE_LABELS[mode]}" vyžaduje IČ DPH odberateľa.`,
      fix: "Doplň IČ DPH odberateľa.",
    })
  }

  // Required legal note for the mode must be present on the document.
  const requiredNote = legalNoteForVatMode(mode, "sk")
  if (requiredNote && !(doc.legal_notes ?? "").includes(requiredNote)) {
    const severity: ComplianceSeverity =
      mode === "non_payer" ? "warning" : "error"
    issues.push({
      severity,
      message: `Chýba povinná právna poznámka: „${requiredNote}"`,
      fix: "Doplň právnu poznámku zodpovedajúcu režimu DPH.",
    })
  }

  // --- Informational: vehicle expense VAT 50% cap reminder (from 1.1.2026) ---
  if (org.is_vat_payer && issueDate && issueDate >= "2026-01-01") {
    const vehicleHint =
      /\b(auto|automobil|vozidl|palivo|nafta|benzín|benzin|pohonn)/i
    if (items.some((i) => vehicleHint.test(i.description ?? ""))) {
      issues.push({
        severity: "info",
        message:
          "Pri nákladoch súvisiacich s osobným automobilom platí od 1.1.2026 obmedzenie odpočtu DPH na 50 %.",
        fix: "Skontroluj nárok na odpočet DPH pri vozidlách.",
      })
    }
  }

  // --- Score ---
  const penalty = issues.reduce((sum, i) => sum + PENALTY[i.severity], 0)
  const score = Math.max(0, Math.min(100, 100 - penalty))

  return { score, issues }
}
