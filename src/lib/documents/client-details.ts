/**
 * Which customer details a document should show (pure, no I/O).
 *
 * A document keeps `contact_id`, but a contact is a living record — renaming a
 * customer or moving his seat would otherwise rewrite every invoice already
 * issued to him. Documents issued from now on carry `client_snapshot`: a frozen
 * copy of the details as of the moment of issue (written by
 * `buildClientSnapshot`). Drafts and documents issued before the migration have
 * none, so those keep reading the contact live, exactly as before.
 *
 * ZAMERNE bez fallbacku po jednotlivych poliach: ked snapshot existuje, plati
 * cely. Doplnit chybajucu ulicu zo ziveho kontaktu by vratilo presne tu chybu,
 * kvoli ktorej snapshot vznikol — na uctovnom doklade by sa objavila adresa,
 * ktora v case vystavenia neplatila.
 */

import type { ClientSnapshotSource } from "./client-snapshot"

export type ClientDetails = {
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  email: string | null
  phone: string | null
  iban: string | null
  swift: string | null
  /** true = udaje su zmrazene k okamihu vystavenia, nie zive z `contacts`. */
  frozen: boolean
  /** ISO okamih zmrazenia; null pri zivych udajoch aj pri snapshote bez neho. */
  snapshotAt: string | null
}

/** Prazdny alebo cisto biely retazec je to iste ako chybajuci udaj. */
function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim()
  return trimmed === "" ? null : trimmed
}

/**
 * `client_snapshot` je `Json`, teda hocico — zuzujeme ho rucne. Pole ani skalar
 * nie je snapshot.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

/**
 * Precita jedno textove pole. Cislo prijmeme tiez — rucne upravene JSON vie mat
 * ICO ako number a je lepsie ho zobrazit, nez zahodit.
 */
function field(record: Record<string, unknown>, key: string): string | null {
  const raw = record[key]
  if (typeof raw === "string") return clean(raw)
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  return null
}

/**
 * Picks the customer details to display: the frozen snapshot when the document
 * has a usable one, otherwise the live contact row. Returns null when neither
 * yields a name (document without a customer).
 *
 * `snapshot` je zamerne `unknown` — prichadza zo stlpca `jsonb`, takze jedine
 * bezpecne je zuzit ho tu na jednom mieste namiesto pretypovania na volajucich.
 */
export function resolveClientDetails(
  snapshot: unknown,
  contact: ClientSnapshotSource | null | undefined,
): ClientDetails | null {
  const record = asRecord(snapshot)
  const frozenName = record ? field(record, "name") : null

  // Snapshot bez mena je rozbity (DB constraint meno vyzaduje) — vtedy je
  // zivy kontakt lepsi nez prazdna hlavicka odberatela.
  if (record && frozenName) {
    return {
      name: frozenName,
      ico: field(record, "ico"),
      dic: field(record, "dic"),
      ic_dph: field(record, "ic_dph"),
      street: field(record, "street"),
      city: field(record, "city"),
      postal_code: field(record, "postal_code"),
      country: field(record, "country"),
      email: field(record, "email"),
      phone: field(record, "phone"),
      iban: field(record, "iban"),
      swift: field(record, "swift"),
      frozen: true,
      snapshotAt: field(record, "snapshot_at"),
    }
  }

  const name = clean(contact?.name)
  if (!name) return null

  return {
    name,
    ico: clean(contact?.ico),
    dic: clean(contact?.dic),
    ic_dph: clean(contact?.ic_dph),
    street: clean(contact?.street),
    city: clean(contact?.city),
    postal_code: clean(contact?.postal_code),
    country: clean(contact?.country),
    email: clean(contact?.email),
    phone: clean(contact?.phone),
    iban: clean(contact?.iban),
    swift: clean(contact?.swift),
    frozen: false,
    snapshotAt: null,
  }
}
