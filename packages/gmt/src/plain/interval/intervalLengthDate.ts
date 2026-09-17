import type { Temporal } from "@js-temporal/polyfill";
import {
  parseCalendarDatePairForArithmetic,
  resolveDateTimeUnit,
} from "../../internal";
import {
  type CalendarDateUnit,
  calendarDateAdd,
  calendarDateUntil,
} from "../../internal/temporalCompat";
import { isValidDateUnit } from "../validate";
import { isValidDateInterval } from "./validate";

const UNIT_FIELD = {
  year: "years",
  month: "months",
  week: "weeks",
  day: "days",
} as const;

function daysBetween(from: Temporal.PlainDate, to: Temporal.PlainDate): number {
  return from
    .withCalendar("iso8601")
    .until(to.withCalendar("iso8601"), { largestUnit: "days" }).days;
}

/**
 * `Duration.total({ unit, relativeTo: start })` of a non-ISO calendar difference, computed as TC39
 * `TotalRelativeDuration` → `NudgeToCalendarUnit` does, over the Temporal compat layer's calendar
 * add and until (CORE-6: the polyfill's own `total` runs its D1/D6/D7-affected arithmetic):
 * `r1` whole units from `CalendarDateUntil`, plus the days from `start + r1` to `end` over the days
 * from `start + r1` to `start + (r1 + 1)`, both added with `constrain`. `start <= end`.
 */
function calendarLength(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  unit: CalendarDateUnit,
): number {
  const field = UNIT_FIELD[unit];
  const whole = calendarDateUntil(start, end, unit)[field];
  const lower = calendarDateAdd(start, { [field]: whole }, "constrain");
  const upper = calendarDateAdd(start, { [field]: whole + 1 }, "constrain");
  return whole + daysBetween(lower, end) / daysBetween(lower, upper);
}

/**
 * Return the exact length of a date interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountDate`, which counts calendar `unit` boundaries *crossed* rather
 *   than measuring exact duration — see `intervalCountDate`'s JSDoc for the canonical
 *   11:59pm→12:01am example of the two diverging. `intervalLengthDate` answers "how long is
 *   this interval", `intervalCountDate` answers "how many boundaries does it touch".
 * - Uses `Temporal.Duration.prototype.total` semantics, which resolve calendar units (month, year)
 *   against the interval's own start so a partial month is expressed as a true fraction rather
 *   than truncated (non-ISO calendars follow the same TC39 NudgeToCalendarUnit steps over
 *   calendar-correct arithmetic).
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   or a unit that has no effect on `PlainDate`, e.g. `"hours"`).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). When `start` and `end`
 *   carry the *same* calendar tag, the length is measured in that calendar; when they name
 *   different calendars the result is `null` — same calendar rule as `intervalCountDate` (TC39
 *   `CalendarEquals`; before 1.16.0 measured in ISO).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param start ISO PlainDate string for the interval start, optionally calendar-annotated
 * @param end ISO PlainDate string for the interval end, optionally calendar-annotated
 * @param unit unit string — `"year" | "month" | "week" | "day"` (time units return null)
 * @returns exact length of the interval expressed in `unit`, or null on invalid input
 *
 * @example intervalLengthDate("2024-01-01", "2024-01-03", "day") // 2
 * @example intervalLengthDate("2024-01-01", "2024-01-16", "day") // 15
 * @example intervalLengthDate("2024-01-01", "2024-01-16", "month") // 0.4838709677419355 (15 of January's 31 days)
 * @example intervalLengthDate("2024-01-01", "2024-01-01", "day") // 0
 * @example intervalLengthDate("2024-01-01", "2024-01-10", "hour") // null
 * @example intervalLengthDate("invalid", "2024-01-10", "day") // null
 */
export function intervalLengthDate(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateUnit(resolvedUnit)) {
    return null;
  }

  if (!isValidDateInterval(start, end)) {
    return null;
  }

  try {
    const { a: startVal, b: endVal } = parseCalendarDatePairForArithmetic(
      start,
      end,
    );

    if (startVal.calendarId !== "iso8601") {
      return calendarLength(startVal, endVal, resolvedUnit as CalendarDateUnit);
    }

    const duration = startVal.until(endVal, { largestUnit: resolvedUnit });

    // total() gives the exact (possibly fractional) length, unlike intervalCountDate's
    // boundary-crossing count — e.g. Jan 31 -> Feb 1 is 1 month boundary via intervalCountDate
    // but only a fraction of a month via total().
    return duration.total({ unit: resolvedUnit, relativeTo: startVal });
  } catch {
    return null;
  }
}
