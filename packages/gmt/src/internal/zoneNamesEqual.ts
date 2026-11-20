import type { Temporal } from "./temporal";
import { asciiLower } from "./refusedZoneNames";

/**
 * The names ECMA-402 §6.5.1 resolves to `"UTC"` by name, in lower case, with no time zone data:
 * the last step of AvailableNamedTimeZoneIdentifiers (`Etc/UTC`, `Etc/GMT` and `GMT`).
 */
const RESOLVES_TO_UTC: ReadonlySet<string> = new Set([
  "etc/utc",
  "etc/gmt",
  "gmt",
]);

/** The lower-case name, or `"utc"` for one of the names that resolve to `UTC`. */
function nameKey(id: string): string {
  const lower = asciiLower(id);
  return RESOLVES_TO_UTC.has(lower) ? "utc" : lower;
}

/**
 * Whether two zoned values are in one time zone by name: the same identifier ignoring ASCII case,
 * or two of the names ECMA-402 §6.5.1 resolves to `"UTC"` (`UTC`, `Etc/UTC`, `Etc/GMT`, `GMT`). A
 * Link and its Zone are two zones on every host: no API names a Link's primary identifier on every
 * host, and GMT owns no link data (GMT rule; this departs from Temporal TimeZoneEquals, which
 * compares primary identifiers, for Links only). It reads no host `Temporal`, no zone data and
 * keeps no cache.
 *
 * @param one a zoned value
 * @param two a zoned value
 * @returns true when the two names are one zone
 *
 * @example zoneNamesEqual(Temporal.ZonedDateTime.from("2024-01-01T00:00:00+00:00[UTC]"), Temporal.ZonedDateTime.from("2024-01-01T00:00:00+00:00[Etc/UTC]")) // true
 * @example zoneNamesEqual(Temporal.ZonedDateTime.from("2024-01-01T05:30:00+05:30[Asia/Calcutta]"), Temporal.ZonedDateTime.from("2024-01-01T05:30:00+05:30[Asia/Kolkata]")) // false
 */
export function zoneNamesEqual(
  one: Temporal.ZonedDateTime,
  two: Temporal.ZonedDateTime,
): boolean {
  return nameKey(one.timeZoneId) === nameKey(two.timeZoneId);
}
