import { Temporal } from "@js-temporal/polyfill";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import { isValidTimeZone } from "../../zoned/validate/isValidTimeZone";

/** What `crossingTime` returns: exact elapsed time plus the local view at either end. */
export interface Crossing {
  /** Exact elapsed time from entry to exit, as an ISO 8601 duration with hours as the largest unit. */
  duration: string;
  /** The entry, rendered in the target zone. */
  enter: string;
  /** The exit, rendered in the target zone. */
  exit: string;
}

/**
 * Measure a crossing — a canal transit, a strait passage, a border queue — and render both ends
 * in the zone the crossing is administered in.
 *
 * A crossing is logged as two instants, and the authority that schedules it reads both on its
 * own clock. `crossingTime` returns the exact elapsed time between them plus the zone-local
 * entry and exit. It deliberately counts no calendar days: dwell charged by local days
 * (`calendarDays`) is `dwellTime`'s job, and a crossing that needs a day count is a dwell.
 *
 * - **`duration` is exact elapsed time.** A crossing spanning a DST transition reports the hours
 *   that actually elapsed; the local wall clocks at either end can be an hour apart from that.
 *   Hours is the largest unit, so the value never depends on a calendar.
 * - **`targetZone` is always the rendering zone.** `entry` and `exit` are anything
 *   `isValidInstant` accepts — `Z`, an offset, or an offset with a bracketed zone — and only the
 *   instant is read: a bracketed zone in the input is never the zone the result is rendered in,
 *   as `Temporal.Instant.from` also ignores it. That is the one contract difference from
 *   `dwellTime`, whose zone may come from its entry's bracket.
 * - `targetZone` is whatever `isValidTimeZone` accepts, which is what Temporal accepts: an IANA
 *   identifier, or a fixed offset such as `"+02:00"`, which observes no DST.
 * - GMT does not resolve a canal, lock or checkpoint code to a zone; the caller supplies the
 *   identifier.
 * - Returns `null` when either instant is invalid, when `exit` is before `entry` (an inverted
 *   crossing is a data error, not a negative transit), or when the zone is invalid. A zero-length
 *   crossing is `PT0S`.
 *
 * @param entry ISO 8601 zoned datetime or instant string of entering the crossing
 * @param exit ISO 8601 zoned datetime or instant string of leaving it
 * @param targetZone IANA timeZone identifier or fixed offset the crossing is read in
 * @returns exact duration and zone-local entry and exit, or null on invalid input
 *
 * @example crossingTime("2024-06-15T08:00:00Z", "2024-06-15T17:30:00Z", "Europe/Berlin") // { duration: "PT9H30M", enter: "2024-06-15T10:00:00+02:00[Europe/Berlin]", exit: "2024-06-15T19:30:00+02:00[Europe/Berlin]" }
 * @example crossingTime("2024-06-15T10:00:00+09:00", "2024-06-15T12:00:00+09:00", "Asia/Tokyo") // { duration: "PT2H", enter: "2024-06-15T10:00:00+09:00[Asia/Tokyo]", exit: "2024-06-15T12:00:00+09:00[Asia/Tokyo]" }
 * @example crossingTime("2024-03-10T05:00:00Z", "2024-03-10T12:00:00Z", "America/New_York") // { duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]", exit: "2024-03-10T08:00:00-04:00[America/New_York]" } (seven elapsed hours across the spring-forward)
 * @example crossingTime("2024-11-03T05:30:00Z", "2024-11-03T06:30:00Z", "America/New_York") // { duration: "PT1H", enter: "2024-11-03T01:30:00-04:00[America/New_York]", exit: "2024-11-03T01:30:00-05:00[America/New_York]" } (both ends read 01:30; the offsets tell them apart)
 * @example crossingTime("2024-06-15T10:00:00Z", "2024-06-15T10:00:00Z", "Asia/Tokyo") // { duration: "PT0S", enter: "2024-06-15T19:00:00+09:00[Asia/Tokyo]", exit: "2024-06-15T19:00:00+09:00[Asia/Tokyo]" }
 * @example crossingTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "+02:00") // { duration: "PT2H30M", enter: "2024-06-16T00:30:00+02:00[+02:00]", exit: "2024-06-16T03:00:00+02:00[+02:00]" } (a fixed offset renders with no DST)
 * @example crossingTime("2024-06-16T01:00:00Z", "2024-06-15T22:30:00Z", "Europe/London") // null (exit before entry)
 * @example crossingTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/Londres") // null
 * @example crossingTime("2024-06-15T22:30:00", "2024-06-16T01:00:00Z", "Europe/London") // null (no offset designator: not a moment)
 */
export function crossingTime(
  entry: string,
  exit: string,
  targetZone: string,
): Crossing | null {
  try {
    // fallow-ignore-next-line code-duplication -- not delegated to dwellTime: its transition walk returns null past 10,000 transitions, a false null for a long crossing, and its calendar-day count is work crossingTime does not use
    if (
      !isValidInstant(entry) ||
      !isValidInstant(exit) ||
      !isValidTimeZone(targetZone)
    ) {
      return null;
    }

    const entryInstant = Temporal.Instant.from(entry);
    const exitInstant = Temporal.Instant.from(exit);
    if (Temporal.Instant.compare(entryInstant, exitInstant) > 0) {
      return null;
    }

    return {
      duration: entryInstant
        .until(exitInstant, { largestUnit: "hours" })
        .toString(),
      enter: entryInstant.toZonedDateTimeISO(targetZone).toString(),
      exit: exitInstant.toZonedDateTimeISO(targetZone).toString(),
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
