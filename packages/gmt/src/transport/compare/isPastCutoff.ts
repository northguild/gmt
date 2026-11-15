import { Temporal } from "../../internal/temporal";
import { instantOf } from "../../internal/instantNanoseconds";
import { zonedInstantOf } from "../../internal/exactMoment";

/**
 * Report whether a cut-off has passed.
 *
 * The window to meet a cut-off is half-open, `[…, cutoff)`: at the cut-off instant itself it
 * has closed, so `now` equal to `cutoff` is past. This matches the half-open rule GMT's
 * intervals follow, and `timeToCutoff`, which is `PT0S` there.
 *
 * - `now` is an exact instant (`Z`/offset) with no annotation of any kind. `cutoff` is the
 *   zoned string `cutoffAt` returns, `<date>T<time>±HH:MM[Zone]`: an offset (or `Z`), then one
 *   time zone bracket that agrees with it (the critical `[!Zone]` too), and nothing after. A
 *   bare instant, an offset-less wall time, an offset bracket (`[+02:00]`) or any other
 *   annotation is invalid. They are compared as instants, so the two passes of a repeated hour
 *   are told apart by their offsets.
 * - `now` is the caller's: GMT does not read the clock here, so the answer is reproducible.
 * - Returns `false` on invalid input, including `cutoffAt`'s `""` sentinel — which reads as
 *   "not past". Check the cut-off is not `""` before trusting a `false`.
 *
 * @param now ISO 8601 instant string of the moment asked about
 * @param cutoff ISO 8601 zoned datetime string of the cut-off, exactly as `cutoffAt` returns it
 * @returns true when now is at or after the cut-off, false otherwise or on invalid input
 *
 * @example isPastCutoff("2024-06-12T16:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // true
 * @example isPastCutoff("2024-06-12T14:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // false
 * @example isPastCutoff("2024-06-12T15:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // true (at the cut-off, the window has closed)
 * @example isPastCutoff("2024-04-06T16:00:00Z", "2024-04-07T02:30:00+11:00[Australia/Sydney]") // true (the first 02:30 is 15:30Z, already gone)
 * @example isPastCutoff("2024-04-06T16:00:00Z", "2024-04-07T02:30:00+10:00[Australia/Sydney]") // false (the second 02:30 is 16:30Z, half an hour away)
 * @example isPastCutoff("2024-06-12T16:00:00Z", "2024-06-12T15:00:00Z") // false (a bare instant is not a zoned cut-off)
 * @example isPastCutoff("2024-06-12T16:00:00", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]") // false (a zoneless now is not a moment)
 * @example isPastCutoff("2024-06-12T16:00:00+02:00[Europe/Amsterdam]", "2024-06-12T15:00:00Z") // false (`now` takes no annotation)
 * @example isPastCutoff("2024-06-12T16:00:00Z", "") // false
 */
export function isPastCutoff(now: string, cutoff: string): boolean {
  try {
    const nowInstant = instantOf(now);
    if (nowInstant === null) {
      return false;
    }

    const cutoffInstant = zonedInstantOf(cutoff);
    if (cutoffInstant === null) {
      return false;
    }

    return Temporal.Instant.compare(nowInstant, cutoffInstant) >= 0;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
