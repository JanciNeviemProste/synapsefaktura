import "server-only"

import { encode, PaymentOptions } from "bysquare/pay"
import { Version } from "bysquare"
import QRCode from "qrcode"

export interface PaymentQrInput {
  iban: string
  amount: number
  currency: string
  variableSymbol?: string | null
  note?: string | null
  /** Due date in YYYY-MM-DD. */
  dueDate?: string | null
  /** Customer country — CZ switches to the Czech QR Platba (SPD) standard. */
  customerCountry?: string | null
  /** Beneficiary (supplier) name — required by the bysquare data model. */
  beneficiaryName?: string | null
}

const QR_OPTS = { margin: 1, width: 240 } as const

/** SK PAY by square QR as a PNG data URL (§5.4). */
async function payBySquare(input: PaymentQrInput): Promise<string> {
  const qrString = encode(
    {
      invoiceId: input.variableSymbol?.slice(0, 10),
      payments: [
        {
          type: PaymentOptions.PaymentOrder,
          amount: input.amount,
          currencyCode: input.currency,
          variableSymbol: input.variableSymbol ?? undefined,
          paymentDueDate: input.dueDate
            ? input.dueDate.replaceAll("-", "")
            : undefined,
          paymentNote: input.note ?? undefined,
          bankAccounts: [{ iban: input.iban.replaceAll(" ", "") }],
          beneficiary: { name: input.beneficiaryName ?? "" },
        },
      ],
    },
    // v1.0.0 keeps the widest banking-app compatibility (no beneficiary name).
    { version: Version["1.0.0"] },
  )
  return QRCode.toDataURL(qrString, QR_OPTS)
}

/** Czech QR Platba (SPD) as a PNG data URL — SK QR won't load in CZ apps (§5.4). */
async function czQrPlatba(input: PaymentQrInput): Promise<string> {
  const parts = [
    "SPD*1.0",
    `ACC:${input.iban.replaceAll(" ", "")}`,
    `AM:${input.amount.toFixed(2)}`,
    `CC:${input.currency}`,
  ]
  if (input.variableSymbol) parts.push(`X-VS:${input.variableSymbol}`)
  if (input.note) parts.push(`MSG:${input.note.slice(0, 60)}`)
  return QRCode.toDataURL(parts.join("*"), QR_OPTS)
}

/**
 * Returns a payment QR PNG data URL, branching by customer country (CZ → SPD,
 * otherwise PAY by square). Returns null when there's no IBAN to encode.
 */
export async function paymentQrDataUrl(
  input: PaymentQrInput,
): Promise<string | null> {
  if (!input.iban?.trim()) return null
  try {
    const isCz = (input.customerCountry ?? "").toUpperCase() === "CZ"
    return isCz ? await czQrPlatba(input) : await payBySquare(input)
  } catch {
    return null
  }
}
