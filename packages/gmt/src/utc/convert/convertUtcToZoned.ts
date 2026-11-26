import { isZoneId } from "../../internal/inputChecks";
import { utcInstantOf } from "../../internal/utcInstant";

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
 * @example convertUtcToZoned("2024-02-29T00:00:00Z", "Australia/Sydney") // "2024-02-29T11:00:00+11:00[Australia/Sydney]"
 * @example convertUtcToZoned("invalid", "UTC") // ""
 */
export function convertUtcToZoned(value: string, timeZone: string): string {
  const instant = utcInstantOf(value);
  if (instant === null || !isZoneId(timeZone)) {
    return "";
  }

  try {
    return instant.toZonedDateTimeISO(timeZone).toString();
  } catch {
    return "";
  }
}
