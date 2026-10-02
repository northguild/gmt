import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../../duration/validate";
import {
  addToZonedDisambiguated,
  calendarSystemOfZonedValue,
  formatZonedInCalendar,
  parseCalendarZonedValue,
  resolveOverflow,
} from "../../internal";
import type { Disambiguation, Overflow } from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Construct a zoned interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - Uses `Temporal.ZonedDateTime.prototype.add`/`.subtract`, so calendar units (years/months/weeks)
 *   resolve against `value` itself — no separate `relativeTo` is needed.
 * - Follows Temporal's AddZonedDateTime: the date portion of the duration (years, months, weeks,
 *   days) moves the wall-clock date, then the time portion (hours and smaller) is added (subtracted
 *   for `anchor: "end"`) in exact time. `disambiguation` applies ONLY to the intermediate
 *   wall-clock date-time after the date portion, exactly as Temporal's GetEpochNanosecondsFor
 *   resolves it. It never re-resolves the exact-time result.
 * - Compatibility: before 1.16.0 a date portion landing in a spring-forward gap was always moved
 *   forward, whatever `disambiguation` said. Pass "compatible" (or omit it) to keep that result.
 * - Compatibility: before 1.16.0 a non-"compatible" `disambiguation` re-resolved the final wall
 *   clock (so `+ { minutes: 10 }` from `01:30-05:00` with "earlier" returned `01:40-04:00`, 50
 *   minutes earlier in exact time). To get that value, re-resolve the result's wall clock:
 *   `setZoned(result, { hour, minute, second }, { disambiguation, offset: "ignore" })`.
 * - There is no `offset` option (removed in 1.16.0): the computed endpoint's wall clock is resolved
 *   from a plain date-time, which has no UTC offset for it to act on.
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionZoned`'s `start > end` rejection.
 * - Accepts a RFC 9557 calendar-annotated zoned string (as produced by `convertZonedToCalendar`) as
 *   well as a bare ISO one — E7 (issue #152). Calendar units in `duration` resolve against that
 *   calendar, and both returned endpoints are re-derived in it via `formatZonedInCalendar`. There
 *   is only ONE calendar-tagged input here, so there is no second calendar to mismatch.
 * - Returns null on invalid input (unparseable `value`, invalid `duration`, or an `anchor` other
 *   than `"start"`/`"end"`).
 *
 * @param value ISO 8601 zoned datetime string, optionally calendar-annotated
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional settings for resolving a DST gap or overlap and an out-of-range date
 * @returns `{ start, end }` with the constructed span, or null on invalid input
 *
 * @example intervalFromDurationZoned("2024-01-01T00:00:00+00:00[UTC]", "P1D", "start") // { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }
 * @example intervalFromDurationZoned("2024-01-02T00:00:00+00:00[UTC]", "P1D", "end") // { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }
 * @example intervalFromDurationZoned("2024-11-02T01:30:00-04:00[America/New_York]", "P1D", "start", { disambiguation: "later" }) // { start: "2024-11-02T01:30:00-04:00[America/New_York]", end: "2024-11-03T01:30:00-05:00[America/New_York]" } (fall-back overlap resolved; default "compatible" would return the -04:00 instant instead)
 * @example intervalFromDurationZoned("2024-03-09T02:30:00-05:00[America/New_York]", "P1D", "start", { disambiguation: "earlier" }) // { start: "2024-03-09T02:30:00-05:00[America/New_York]", end: "2024-03-10T01:30:00-05:00[America/New_York]" } (spring-forward gap; "earlier" moves the end back an hour)
 * @example intervalFromDurationZoned("2024-03-09T02:30:00-05:00[America/New_York]", "P1D", "start", { disambiguation: "reject" }) // null (spring-forward gap rejected)
 * @example intervalFromDurationZoned("2024-11-03T00:30:00-04:00[America/New_York]", "PT1H", "start", { disambiguation: "later" }) // { start: "2024-11-03T00:30:00-04:00[America/New_York]", end: "2024-11-03T01:30:00-04:00[America/New_York]" } (exact time — disambiguation never re-resolves it)
 * @example setZoned(intervalFromDurationZoned("2024-11-03T00:30:00-04:00[America/New_York]", "PT1H", "start")?.end ?? "", { hour: 1, minute: 30, second: 0 }, { disambiguation: "later", offset: "ignore" }) // "2024-11-03T01:30:00-05:00[America/New_York]" (pre-1.16.0 end)
 * @example intervalFromDurationZoned("2024-01-31T12:00:00-05:00[America/New_York]", "P1M", "start", { overflow: "reject" }) // null
 * @example intervalFromDurationZoned("invalid", "P1D", "start") // null
 */
export function intervalFromDurationZoned(
  value: string,
  duration: string,
  anchor: "start" | "end",
  options?: {
    /**
     * How the intermediate wall-clock date-time, reached after the date portion of the duration is
     * applied, resolves when it falls in a DST gap or overlap. In a fall-back overlap
     * `"compatible"` and `"earlier"` take the earlier instant and `"later"` the later one; in a
     * spring-forward gap `"compatible"` and `"later"` move the wall clock forward by the gap length
     * and `"earlier"` back by it. `"reject"` returns null for both, and a time-only duration
     * ignores the option.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
    /**
     * What happens when the result names a day its month does not have, such as adding 1 month to
     * 31 January. `"constrain"` clamps to the last valid day; `"reject"` returns null.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): {
  /**
   * The instant the interval begins at, as a zoned ISO 8601 string with offset and bracketed time
   * zone. It keeps a calendar annotation such as `[u-ca=hebrew]` when the inputs carry one.
   */
  start: string;
  /**
   * The first instant after the interval, in the same format as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It can equal
   * `start`, which makes the interval empty.
   */
  end: string;
} | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    if (!isValidCalendarZonedDateTime(value)) {
      return null;
    }

    if (!isValidDuration(duration)) {
      return null;
    }

    if (anchor !== "start" && anchor !== "end") {
      return null;
    }

    const disambiguation =
      options?.disambiguation === undefined
        ? "compatible"
        : options.disambiguation;
    const overflow = resolveOverflow(options?.overflow);

    try {
      const calendar = calendarSystemOfZonedValue(value);
      if (!calendar) {
        return null;
      }
      const point = parseCalendarZonedValue(value);
      const dur = Temporal.Duration.from(duration);

      const other = addToZonedDisambiguated(
        point,
        dur,
        anchor === "start" ? 1 : -1,
        { overflow, disambiguation },
      );

      const start = anchor === "start" ? point : other;
      const end = anchor === "start" ? other : point;

      if (Temporal.ZonedDateTime.compare(start, end) > 0) {
        return null;
      }

      return {
        start: formatZonedInCalendar(start, calendar),
        end: formatZonedInCalendar(end, calendar),
      };
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
