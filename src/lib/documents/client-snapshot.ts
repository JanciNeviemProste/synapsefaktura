/**
 * Frozen copy of the customer's details as of the moment of issue (pure, no I/O).
 *
 * A document keeps `contact_id`, but a contact is a living record: renaming a
 * customer or moving his seat would otherwise rewrite every invoice ever issued
 * to him. `documents.client_snapshot` holds what was true when the document was
 * issued, and a DB trigger (`freeze_client_snapshot`) refuses any later change.
 *
 * The DB check constraint requires at least a `name`, so a contact without one
 * yields no snapshot at all rather than a row the database would reject.
 */

/** Podmnozina stlpcov `contacts`, z ktorych sa snapshot sklada. */
export type ClientSnapshotSource = {
  name?: string | null
  ico?: string | null
  dic?: string | null
  ic_dph?: string | null
  street?: string | null
  city?: string | null
  postal_code?: string | null
  country?: string | null
  email?: string | null
  phone?: string | null
  iban?: string | null
  swift?: string | null
}

export type ClientSnapshot = {
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
  /** ISO timestamp okamihu vystavenia. */
  snapshot_at: string
}

/** Prazdny alebo cisto biely retazec je to iste ako chybajuci udaj. */
function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim()
  return trimmed === "" ? null : trimmed
}

/**
 * Builds the snapshot from a `contacts` row. Returns null when the contact has
 * no usable name — such a snapshot would violate the DB constraint and the
 * document is better off with none than with a broken one.
 */
export function buildClientSnapshot(
  contact: ClientSnapshotSource | null | undefined,
  snapshotAt: string = new Date().toISOString(),
): ClientSnapshot | null {
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
    snapshot_at: snapshotAt,
  }
}
