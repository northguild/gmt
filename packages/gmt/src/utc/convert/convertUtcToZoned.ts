import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned/validate";
import { isValidUtc } from "../validate";

/**
 * Convert a UTC Instant string to a zoned ISO 8601 datetime string.
 *
 * - Uses Temporal.Instant.from to parse, converts to specified timezone.
 * - Validates both UTC input and timezone.
 * - Returns "" for invalid input.
 * - An offset with seconds (`-00:44:30`) returns `""`. A written zone cannot carry seconds (RFC
 *   9557 §4.1), so the result could not name it. Pass the IANA name, or call
 *   `fromOffsetInstant({ instant, offset })` for the local time with its full offset and no
 *   bracket.
 *
 * @param value UTC Instant string
 * @param timeZone IANA name or a UTC offset to the minute (what `isValidTimeZone` accepts)
 * @returns zoned ISO 8601 string or "" on invalid
 *
 * @example convertUtcToZoned("2024-02-29T00:00:00Z", "America/New_York") // "2024-02-28T19:00:00-05:00[America/New_York]"
 * @example convertUtcToZoned("invalid", "UTC") // ""
 */
export function convertUtcToZoned(value: string, timeZone: string): string {
  if (!isValidUtc(value) || !isValidTimeZone(timeZone)) {
    return "";
  }

  try {
    return Temporal.Instant.from(value).toZonedDateTimeISO(timeZone).toString();
  } catch {
    return "";
  }
}
