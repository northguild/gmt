import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../../zoned/validate";

/**
 * Units `spanWallClock` measures a calendar distance in.
 *
 * | Unit | Meaning |
 * | --- | --- |
 * | `days` | Whole wall-clock days — a calendar day, whatever number of hours it happened to last. |
 * | `hours` | Whole wall-clock hours — the hours a clock face advanced, not the hours that elapsed. |
 */
export type WallClockSpanUnit = "days" | "hours";

const WALL_CLOCK_SPAN_UNITS: Record<WallClockSpanUnit, Temporal.DateTimeUnit> =
  {
    days: "day",
    hours: "hour",
  };

/**
 * Return the wall-clock distance between two zoned datetime strings — calendar time, not
 * elapsed time.
 *
 * The counterpart to `spanMs`. Both are correct answers to different questions, and
 * conflating them is the most common span bug there is: across a DST transition "one day
 * later" and "24 hours later" are not the same moment.
 *
 * - Reads each endpoint's own local wall clock and measures between them, so a calendar day
 *   is 1 day and 24 hours in every zone, including one whose offset shifted in between.
 *   `spanMs` over the same pair reports the 23, 24.5 or 25 hours that actually elapsed.
 * - Truncates toward zero, so the result is a whole count and `spanWallClock(b, a, unit)` is
 *   `-spanWallClock(a, b, unit)`. Noon Friday to 18:00 Saturday is 1 day, or 30 hours — ask
 *   for `hours` when the remainder matters.
 * - **Not a count of boundaries crossed.** 23:00 to 01:00 the next calendar day is `0` days,
 *   not `1`; that question is about local midnights, and is `startOfZoned`'s to answer.
 * - **No disambiguation policy applies, because no local time is converted to an instant.**
 *   The wall clock is read straight off the string with `Temporal.PlainDateTime.from`. Going
 *   via `ZonedDateTime` would be a local → instant → local round trip, and that round trip is
 *   lossy at exactly the DST edges this function exists to get right: an offset-less
 *   `"2024-03-10T02:30:00[America/New_York]"` names a wall time that never occurred, and
 *   Temporal's default `compatible` disambiguation would silently advance it to `03:30`,
 *   turning a 24-hour answer into 23. A nonexistent or ambiguous local time is measured as
 *   written instead — for a clock-face question, the digits in the string *are* the answer.
 * - Requires a bracketed IANA time zone on both endpoints, as `isValidZonedDateTime` does —
 *   an instant string (`Z`) or a bare offset carries no zone whose wall clock could shift.
 *   The offset is optional, but a present one must match the zone. Leap seconds and
 *   `[u-ca=...]` calendar annotations are rejected; `days` and `hours` mean the same thing in
 *   every calendar system, so the annotation would change nothing.
 * - The endpoints need not share a zone. When they differ, this is the distance between two
 *   local wall clocks — a flight leaving New York at 23:00 and landing in Berlin at 11:00 the
 *   next local day is 12 wall-clock hours, and 7 elapsed hours by `spanMs`.
 * - Returns `null` on invalid input, not `0` — `0` is the span between a wall time and itself.
 *
 * @param start zoned ISO 8601 datetime string the span is measured from
 * @param end zoned ISO 8601 datetime string the span is measured to
 * @param unit "days" or "hours" of wall-clock distance
 * @returns whole wall-clock units, negative when start is after end, or null on invalid input
 *
 * @example spanWallClock("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]", "hours") // 24 — spanMs reports 82800000 (23 hours)
 * @example spanWallClock("2024-11-02T12:00:00-04:00[America/New_York]", "2024-11-03T12:00:00-05:00[America/New_York]", "days") // 1 — spanMs reports 90000000 (25 hours)
 * @example spanWallClock("2024-03-01T12:00:00-05:00[America/New_York]", "2024-03-02T18:00:00-05:00[America/New_York]", "days") // 1 — truncated toward zero
 * @example spanWallClock("2024-03-02T18:00:00-05:00[America/New_York]", "2024-03-01T12:00:00-05:00[America/New_York]", "hours") // -30
 * @example spanWallClock("2024-03-10T23:00:00-04:00[America/New_York]", "2024-03-11T11:00:00+01:00[Europe/Berlin]", "hours") // 12 — each endpoint's own wall clock
 * @example spanWallClock("2024-03-10T02:30:00[America/New_York]", "2024-03-11T02:30:00[America/New_York]", "hours") // 24 — a wall time that never occurred is measured as written
 * @example spanWallClock("2024-03-10T12:00:00Z", "2024-03-11T12:00:00Z", "days") // null — no bracketed time zone
 * @example spanWallClock("2024-03-01T12:00:00-05:00[America/New_York]", "2024-03-02T12:00:00-05:00[America/New_York]", "minutes") // null
 */
export function spanWallClock(
  start: string,
  end: string,
  unit: WallClockSpanUnit,
): number | null {
  if (
    (unit !== "days" && unit !== "hours") ||
    !isValidZonedDateTime(start) ||
    !isValidZonedDateTime(end)
  ) {
    return null;
  }

  try {
    const startWallClock = Temporal.PlainDateTime.from(start);
    const endWallClock = Temporal.PlainDateTime.from(end);
    const duration = startWallClock.until(endWallClock, {
      largestUnit: WALL_CLOCK_SPAN_UNITS[unit],
    });

    return unit === "days" ? duration.days : duration.hours;
  } catch {
    return null;
  }
}
