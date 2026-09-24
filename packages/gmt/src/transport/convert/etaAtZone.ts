import { Temporal } from "@js-temporal/polyfill";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import { isValidTimeZone } from "../../zoned/validate/isValidTimeZone";

/**
 * Render an arrival instant as local time in the zone where it will be read.
 *
 * Schedules are computed in UTC and displayed where the cargo lands. The zone is the caller's
 * fact: GMT does not resolve a port, airport, terminal or station code to a timezone, and
 * takes an IANA identifier instead (see the parked registries note in the epic's painpoints).
 *
 * - `arrivalUtc` is any instant `isValidInstant` accepts — `Z`, an offset, or an offset with a
 *   bracketed zone. Only the instant is read; a bracketed zone in the input is not the zone the
 *   result is rendered in, `targetZone` is.
 * - **No disambiguation arises.** The input is a moment, and a moment has exactly one wall
 *   time in any zone, so the `disambiguation` vocabulary of `resolveLocal` does not apply here.
 *   On a fall-back night two moments an hour apart print the same wall time with different
 *   offsets, and the offset in the result is what tells them apart; on a spring-forward night
 *   the skipped hour simply never appears. That is also why the result carries its offset and
 *   zone rather than a bare wall time.
 * - Returns a zoned ISO 8601 string, `Temporal.ZonedDateTime.prototype.toString()`'s form:
 *   wall time, offset, bracketed zone.
 * - `targetZone` is whatever `isValidTimeZone` accepts, which is what Temporal accepts: an IANA
 *   identifier, or a fixed offset such as `"+09:00"`, which renders with the offset as its zone.
 *   A fixed offset is a legitimate rendering choice for a ship's log (MAR-18); it is not a place.
 * - Returns `""` when the instant or the zone is invalid.
 *
 * @param arrivalUtc ISO 8601 instant string of the arrival
 * @param targetZone IANA timeZone identifier of the place the arrival is read in
 * @returns zoned ISO 8601 string of the local arrival, or "" on invalid input
 *
 * @example etaAtZone("2024-06-15T12:30:00Z", "Asia/Tokyo") // "2024-06-15T21:30:00+09:00[Asia/Tokyo]"
 * @example etaAtZone("2024-06-15T12:30:00Z", "America/Los_Angeles") // "2024-06-15T05:30:00-07:00[America/Los_Angeles]"
 * @example etaAtZone("2024-06-15T12:30:00+02:00", "Pacific/Apia") // "2024-06-15T23:30:00+13:00[Pacific/Apia]" (the offset fixes the instant; the zone renders it)
 * @example etaAtZone("2024-11-03T05:30:00Z", "America/New_York") // "2024-11-03T01:30:00-04:00[America/New_York]" (the first 01:30 of the fall-back night)
 * @example etaAtZone("2024-11-03T06:30:00Z", "America/New_York") // "2024-11-03T01:30:00-05:00[America/New_York]" (the second; the offset tells them apart)
 * @example etaAtZone("2024-06-15T12:30:00", "Asia/Tokyo") // "" (no offset designator: not a moment)
 * @example etaAtZone("2024-06-15T12:30:00Z", "Asia/Tokio") // ""
 */
export function etaAtZone(arrivalUtc: string, targetZone: string): string {
  try {
    if (!isValidInstant(arrivalUtc) || !isValidTimeZone(targetZone)) {
      return "";
    }

    return Temporal.Instant.from(arrivalUtc)
      .toZonedDateTimeISO(targetZone)
      .toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
