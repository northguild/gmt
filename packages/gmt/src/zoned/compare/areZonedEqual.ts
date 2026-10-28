import { Temporal } from "../../internal/temporal";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { timeZoneEquals } from "../../internal/temporalCompat";

/**
 * Compare two zoned datetime strings the way Temporal's `ZonedDateTime.prototype.equals` does.
 *
 * - Inputs must be valid ISO 8601 zoned datetime strings.
 * - Returns `true` when both values are the same instant (equal epoch nanoseconds), are in the same
 *   time zone and use the same calendar; otherwise `false`.
 * - The offset in the string is part of the instant, so the two passes of a repeated wall clock
 *   (`02:30+02:00` and `02:30+01:00` on Berlin's 2024-10-27 fall-back) are different values.
 * - Two identifiers of one time zone are one time zone (Temporal TimeZoneEquals): `UTC`, `Etc/UTC`
 *   and `GMT`, and identifiers that differ only in letter case, on every host. An IANA link such as
 *   `Europe/Kiev` and `Europe/Kyiv` is one zone where the host resolves it; Safari 27 without
 *   `Temporal` keeps the two names as written. An offset zone (`[+05:30]`) equals only the same
 *   offset zone, never a named zone.
 * - The calendar is compared too, but only `iso8601` reaches it: a non-ISO calendar annotation is
 *   invalid input.
 * - The same instant written in two different zones is not equal; compare instants across zones
 *   with `isBeforeZoned` and `isAfterZoned`.
 * - Invalid inputs return `false`.
 *
 * @param value1 first zoned datetime string
 * @param value2 second zoned datetime string
 * @returns `true` when the two zoned datetimes are equal; `false` when they differ or either input is invalid
 *
 * @example areZonedEqual("2024-02-29T12:34:56.789+00:00[UTC]", "2024-02-29T12:34:56.789+00:00[UTC]") // true
 * @example areZonedEqual("2024-10-27T02:30:00+02:00[Europe/Berlin]", "2024-10-27T02:30:00+01:00[Europe/Berlin]") // false (the two passes of Berlin's repeated 02:30 are an hour apart)
 * @example areZonedEqual("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[Etc/UTC]") // true (one time zone, two identifiers)
 * @example areZonedEqual("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[GMT]") // true (GMT is another identifier of UTC)
 * @example areZonedEqual("2024-01-01T12:00:00+01:00[Europe/Berlin]", "2024-01-01T20:00:00+09:00[Asia/Tokyo]") // false (the same instant in two zones)
 * @example areZonedEqual("invalid", "2024-02-29T12:34:56.789+00:00[UTC]") // false
 */
export function areZonedEqual(value1: string, value2: string): boolean {
  if (!isValidZonedDateTime(value1) || !isValidZonedDateTime(value2)) {
    return false;
  }

  let zonedDateTime1: Temporal.ZonedDateTime;
  let zonedDateTime2: Temporal.ZonedDateTime;
  try {
    zonedDateTime1 = zonedDateTimeFrom(value1);
    zonedDateTime2 = zonedDateTimeFrom(value2);
  } catch {
    return false;
  }

  try {
    // ZonedDateTime#equals: epoch nanoseconds, then TimeZoneEquals, then CalendarEquals.
    return (
      zonedDateTime1.epochNanoseconds === zonedDateTime2.epochNanoseconds &&
      timeZoneEquals(zonedDateTime1, zonedDateTime2) &&
      zonedDateTime1.calendarId === zonedDateTime2.calendarId
    );
  } catch {
    return false;
  }
}
