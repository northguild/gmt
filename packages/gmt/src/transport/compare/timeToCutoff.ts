import { instantFrom } from "../../internal";
import { isValidInstant } from "../../precision/validate/isValidInstant";

/**
 * Measure the time left until a cut-off, negative once it has passed.
 *
 * - Exact elapsed time as an ISO 8601 duration with hours as the largest unit, so the value
 *   never depends on a calendar: across a fall-back night, 17:00 to 17:00 the next day is
 *   `PT25H`. It is `PT0S` at the cut-off itself, where `isPastCutoff` turns `true`.
 * - Negative (`"-PT1H"`) once `now` is after the cut-off: how late it is.
 * - Both arguments are exact: an instant (`Z`/offset) or a zoned string, as `cutoffAt`
 *   returns one. The zone each is written in does not matter.
 * - **The offset fixes the instant; a bracketed zone only resolves a rounded one.** An offset
 *   written to the minute that is the bracketed zone's sub-minute offset rounded
 *   (`-00:45[Africa/Monrovia]`, for −00:44:30) names the instant the zone gives, as
 *   `Temporal.ZonedDateTime.from` reads it, so a cut-off `cutoffAt` wrote is the instant it
 *   computed, except a wall time repeated inside a sub-minute offset change, which reads as
 *   its first pass (see `isValidInstant`). Otherwise the bracket is not checked: a zone that does not exist, or that
 *   disagrees with the offset, changes nothing.
 * - `now` is the caller's: GMT does not read the clock here.
 * - Returns `""` on invalid input, including `cutoffAt`'s `""` sentinel.
 *
 * @param now ISO 8601 instant or zoned datetime string of the moment asked about
 * @param cutoff ISO 8601 instant or zoned datetime string of the cut-off
 * @returns ISO 8601 duration from now to the cut-off, negative after it, or "" on invalid input
 *
 * @example timeToCutoff("2024-06-10T15:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "PT48H"
 * @example timeToCutoff("2024-06-12T13:30:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "PT1H30M"
 * @example timeToCutoff("2024-06-12T16:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "-PT1H" (an hour past the cut-off)
 * @example timeToCutoff("2024-06-12T15:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "PT0S"
 * @example timeToCutoff("2024-11-02T17:00:00-04:00[America/New_York]", "2024-11-03T17:00:00-05:00[America/New_York]") // "PT25H" (across the fall-back)
 * @example timeToCutoff("2024-06-12T16:00:00Z", "") // ""
 */
export function timeToCutoff(now: string, cutoff: string): string {
  try {
    if (!isValidInstant(now) || !isValidInstant(cutoff)) {
      return "";
    }

    return instantFrom(now)
      .until(instantFrom(cutoff), { largestUnit: "hours" })
      .toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
