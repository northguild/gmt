import { zonedDateTimeOf } from "../../internal/zonedWallClock";
import { zoneNamesEqual } from "../../internal/zoneNamesEqual";

/**
 * Compare two zoned datetime strings the way Temporal's `ZonedDateTime.prototype.equals` does.
 *
 * - Inputs must be valid ISO 8601 zoned datetime strings.
 * - Returns `true` when both values are the same instant (equal epoch nanoseconds), are in the same
 *   time zone and use the same calendar; otherwise `false`.
 * - The offset in the string is part of the instant, so the two passes of a repeated wall clock
 *   (`02:30+02:00` and `02:30+01:00` on Berlin's 2024-10-27 fall-back) are different values.
 * - Two names of one time zone are equal when they are the same name in any letter case, or both are
 *   `UTC`, `Etc/UTC`, `Etc/GMT` or `GMT` (ECMA-402 §6.5.1). Any other two names are two zones on
 *   every host, including an IANA link and its target (`Europe/Kiev` and `Europe/Kyiv`): no runtime
 *   API gives a link's target on every host. An offset zone (`[+05:30]`) equals only the same offset
 *   zone, never a named zone.
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
 * @example areZonedEqual("2024-01-01T05:30:00+05:30[Asia/Calcutta]", "2024-01-01T05:30:00+05:30[Asia/Kolkata]") // false (a link and its target are two names)
 * @example areZonedEqual("2024-01-01T12:00:00+01:00[Europe/Berlin]", "2024-01-01T20:00:00+09:00[Asia/Tokyo]") // false (the same instant in two zones)
 * @example areZonedEqual("invalid", "2024-02-29T12:34:56.789+00:00[UTC]") // false
 */
export function areZonedEqual(value1: string, value2: string): boolean {
  const zonedDateTime1 = zonedDateTimeOf(value1);
  const zonedDateTime2 = zonedDateTimeOf(value2);
  if (zonedDateTime1 === null || zonedDateTime2 === null) {
    return false;
  }

  try {
    // ZonedDateTime#equals: epoch nanoseconds, then the zone names (GMT's name rule), then CalendarEquals.
    return (
      zonedDateTime1.epochNanoseconds === zonedDateTime2.epochNanoseconds &&
      zoneNamesEqual(zonedDateTime1, zonedDateTime2) &&
      zonedDateTime1.calendarId === zonedDateTime2.calendarId
    );
  } catch {
    return false;
  }
}
