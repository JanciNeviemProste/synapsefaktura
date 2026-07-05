/**
 * Reminder escalation level selection (pure). Levels run 1→3; beyond 3 there is
 * no further reminder. Extracted so the rule is unit-testable without a DB.
 */
export const MAX_REMINDER_LEVEL = 3

/**
 * Next reminder level for a document that already has `existingCount` reminders,
 * or `explicit` when the caller forces a specific level. Returns null when the
 * maximum has been reached (caller should stop).
 */
export function nextReminderLevel(
  existingCount: number,
  explicit?: number,
): number | null {
  const lvl = explicit ?? existingCount + 1
  return lvl > MAX_REMINDER_LEVEL || lvl < 1 ? null : lvl
}
