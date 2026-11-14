import { instantOf } from "../../internal/instantNanoseconds";
import { zonedInstantOf } from "../../internal/exactMoment";

/**
 * Measure the time left until a cut-off, negative once it has passed.
 *
 * - Exact elapsed time as an ISO 8601 duration with hours as the largest unit, so the value
 *   never depends on a calendar: across a fall-back night, 17:00 to 17:00 the next day is
 *   `PT25H`. It is `PT0S` at the cut-off itself, where `isPastCutoff` turns `true`.
 * - Negative (`"-PT1H"`) once `now` is after the cut-off: how late it is.
 * - `now` is an exact instant (`Z`/offset) with no annotation of any kind. `cutoff` is the
 *   zoned string `cutoffAt` returns, `<date>T<time>±HH:MM[Zone]`: an offset (or `Z`), then one
 *   time zone bracket that agrees with it (the critical `[!Zone]` too), and nothing after. A
 *   bare instant, an offset-less wall time, an offset bracket (`[+02:00]`) or any other
 *   annotation is invalid. The offset fixes the instant.
 * - `now` is the caller's: GMT does not read the clock here.
 * - Returns `""` on invalid input, including `cutoffAt`'s `""` sentinel.
 *
 * @param now ISO 8601 instant string of the moment asked about
 * @param cutoff ISO 8601 zoned datetime string of the cut-off, exactly as `cutoffAt` returns it
 * @returns ISO 8601 duration from now to the cut-off, negative after it, or "" on invalid input
 *
 * @example timeToCutoff("2024-06-10T15:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "PT48H"
 * @example timeToCutoff("2024-06-12T13:30:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "PT1H30M"
 * @example timeToCutoff("2024-06-12T16:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "-PT1H" (an hour past the cut-off)
 * @example timeToCutoff("2024-06-12T15:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // "PT0S"
 * @example timeToCutoff("2024-10-26T17:00:00+01:00[Europe/London]", "2024-10-27T17:00:00+00:00[Europe/London]") // "PT25H" (across the fall-back)
 * @example timeToCutoff("2024-06-12T16:00:00Z", "2024-06-12T15:00:00Z") // "" (a bare instant is not a zoned cut-off)
 * @example timeToCutoff("2024-06-12T16:00:00Z", "") // ""
 */
export function timeToCutoff(now: string, cutoff: string): string {
  try {
    const nowInstant = instantOf(now);
    if (nowInstant === null) {
      return "";
    }

    const cutoffInstant = zonedInstantOf(cutoff);
    if (cutoffInstant === null) {
      return "";
    }

    return nowInstant.until(cutoffInstant, { largestUnit: "hours" }).toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
