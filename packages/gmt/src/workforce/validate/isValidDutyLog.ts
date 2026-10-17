import { parseDutyLog } from "../../internal/dutyLog";

/**
 * Validate whether a value is a duty log every `workforce/` function accepts.
 *
 * - True for an array of `{ status, start, end }` entries where `status` is a string and `start`
 *   and `end` are ISO 8601 instant strings (offset required, no leap second), `end` after `start`.
 * - Entries must be ordered by `start` and must not overlap. One may start exactly where the
 *   previous one ends, since entries are half-open, or later, leaving a gap. Order is by instant,
 *   not text.
 * - `[]` is a valid, empty log. Extra keys on an entry are ignored.
 * - Every other `workforce/` function returns its sentinel for a log this rejects.
 * - Returns `false` for a non-array, an entry that is not an object, a non-string status, a bound
 *   that is not an instant, a zero-length or inverted entry, and entries out of order or
 *   overlapping.
 *
 * @param log candidate array of `{ status, start, end }` records
 * @returns boolean indicating whether the log is valid
 *
 * @example isValidDutyLog([{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }, { status: "driving", start: "2024-01-01T10:00:00Z", end: "2024-01-01T15:00:00Z" }]) // true
 * @example isValidDutyLog([]) // true — an empty log
 * @example isValidDutyLog([{ status: "on", start: "2024-01-01T02:00:00Z", end: "2024-01-01T01:00:00Z" }]) // false — inverted
 * @example isValidDutyLog([{ status: "on", start: "2024-01-01T00:00:00Z", end: "2024-01-01T02:00:00Z" }, { status: "off", start: "2024-01-01T01:59:59Z", end: "2024-01-01T03:00:00Z" }]) // false — overlapping
 * @example isValidDutyLog([{ status: "on", start: "2024-01-01T00:00:00", end: "2024-01-01T01:00:00Z" }]) // false — no offset
 */
export function isValidDutyLog(log: unknown): boolean {
  try {
    return parseDutyLog(log) !== null;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
