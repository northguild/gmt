import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../utc/validate/isValidUtc";
import { resolveReadingTimeZone } from "./resolveReadingTimeZone";

/**
 * Read a UTC ISO string as a zoned date-time for the `parse*FromUtc` accessors: the instant it
 * names, on the wall clock of `options.timeZone` (UTC when omitted). The utc twin of
 * `unixZonedDateTime`.
 *
 * @param value UTC ISO 8601 datetime string
 * @param options optional `{ timeZone }`
 * @returns the zoned date-time, or null when the value or the zone is invalid
 * @example utcZonedDateTime("2024-03-15T14:30:00Z", { timeZone: "Asia/Tokyo" })?.toString() // "2024-03-15T23:30:00+09:00[Asia/Tokyo]"
 * @example utcZonedDateTime("2024-03-15T14:30:00Z", { timeZone: "Invalid/Zone" }) // null
 * @example utcZonedDateTime("2024-03-15T14:30:00") // null (no Z)
 */
export function utcZonedDateTime(
  value: string,
  options?: { timeZone?: string },
): Temporal.ZonedDateTime | null {
  if (!isValidUtc(value)) return null;

  const timeZone = resolveReadingTimeZone(options?.timeZone);
  if (timeZone === null) return null;

  try {
    return Temporal.Instant.from(value).toZonedDateTimeISO(timeZone);
  } catch {
    return null;
  }
}
