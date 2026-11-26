import { readMetarTime } from "../../internal/metarTime";

/**
 * Return true when `value` is a METAR, SPECI or TAF time group (`YYGGggZ`) that resolves against
 * `referenceInstant`.
 *
 * - **True exactly when `parseMetarTime` returns an instant** for the same arguments. It calls
 *   the parser, so the two cannot disagree.
 * - **It needs the reference.** The group has no month or year, so a well-formed group against a
 *   reference that is not an ISO 8601 instant is false.
 * - **UTC, no locale.** The group is read as fixed ASCII text in UTC, never through `Intl`.
 *
 * @param value The value to check
 * @param referenceInstant An ISO 8601 instant with `Z` or an offset: the time the report was received or the archive's timestamp
 * @returns `true` for a time group that resolves against the reference, or `false` on invalid input
 *
 * @example isValidMetarTime("302350Z", "2024-07-01T00:05:00Z") // true
 * @example isValidMetarTime("312350Z", "2024-07-01T00:05:00Z") // true (resolves to 31 May)
 * @example isValidMetarTime("321200Z", "2024-07-01T00:05:00Z") // false
 * @example isValidMetarTime("251200", "2024-06-25T12:20:00Z") // false
 * @example isValidMetarTime("251200Z", "2024-06-25T12:20:00") // false
 */
export function isValidMetarTime(
  value: string,
  referenceInstant: string,
): boolean {
  return readMetarTime(value, referenceInstant) !== "";
}
