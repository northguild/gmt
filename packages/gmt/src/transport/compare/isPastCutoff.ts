import { Temporal } from "@js-temporal/polyfill";
import { isValidInstant } from "../../precision/validate/isValidInstant";

/**
 * Report whether a cut-off has passed.
 *
 * The window to meet a cut-off is half-open, `[…, cutoff)`: at the cut-off instant itself it
 * has closed, so `now` equal to `cutoff` is past. This matches the half-open rule GMT's
 * intervals follow, and `timeToCutoff`, which is `PT0S` there.
 *
 * - Both arguments are exact: an instant (`Z`/offset) or a zoned string, as `cutoffAt`
 *   returns one. They are compared as instants, so the zone each is written in does not
 *   matter, and the two passes of a repeated hour are told apart by their offsets. A bracketed
 *   zone is not read.
 * - `now` is the caller's: GMT does not read the clock here, so the answer is reproducible.
 * - Returns `false` on invalid input, including `cutoffAt`'s `""` sentinel — which reads as
 *   "not past". Check the cut-off is not `""` before trusting a `false`.
 *
 * @param now ISO 8601 instant or zoned datetime string of the moment asked about
 * @param cutoff ISO 8601 instant or zoned datetime string of the cut-off
 * @returns true when now is at or after the cut-off, false otherwise or on invalid input
 *
 * @example isPastCutoff("2024-06-12T16:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // true
 * @example isPastCutoff("2024-06-12T14:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // false
 * @example isPastCutoff("2024-06-12T15:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // true (at the cut-off, the window has closed)
 * @example isPastCutoff("2024-11-03T01:30:00-05:00[America/New_York]", "2024-11-03T01:30:00-04:00[America/New_York]") // true (the second 01:30 is an hour after the first)
 * @example isPastCutoff("2024-06-12T16:00:00", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // false (a zoneless now is not a moment)
 * @example isPastCutoff("2024-06-12T16:00:00Z", "") // false
 */
export function isPastCutoff(now: string, cutoff: string): boolean {
  try {
    if (!isValidInstant(now) || !isValidInstant(cutoff)) {
      return false;
    }

    return (
      Temporal.Instant.compare(
        Temporal.Instant.from(now),
        Temporal.Instant.from(cutoff),
      ) >= 0
    );
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
