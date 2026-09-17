import { Temporal } from "@js-temporal/polyfill";
import { durationRound, resolveDurationRelativeTo } from "../../internal";
import type { DurationRelativeTo } from "../../types";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Roll an ISO 8601 duration string's small units into larger ones.
 *
 * - Uses Temporal.Duration.from and .round to rebalance, then .toString() to re-emit.
 * - Defaults to { largestUnit: "auto" }, which resolves to the larger of smallestUnit and the
 *   duration's own largest non-zero unit, then balances up to it. Units are promoted only up to
 *   a unit already present: "PT90M" stays "PT90M", but "P1DT25H" becomes "P2DT1H" and "PT1H90M"
 *   becomes "PT2H30M". Pass an explicit largestUnit to promote further.
 * - relativeTo is required whenever a calendar unit (year/month/week) is involved,
 *   either as the requested largestUnit or because the input duration already has a
 *   nonzero year/month/week component (this applies even under the "auto" default).
 *   Without relativeTo in either case, returns "".
 * - roundingIncrement must evenly divide, and be less than, 24 for hour, 60 for minute/second
 *   and 1000 for millisecond/microsecond/nanosecond (so 60 and 24 themselves are rejected).
 *   For year/month/week/day it has no maximum, but an increment above 1 is rejected unless
 *   largestUnit is that same unit ("auto" resolves to the largest unit present). An invalid
 *   increment returns "".
 * - A zoned relativeTo string resolves its wall time with disambiguation "compatible" and offset
 *   "reject", as Temporal does: an ambiguous wall time takes the earlier instant, a nonexistent
 *   one the later instant, and an offset that does not match the zone returns "". Pass an
 *   explicit offset to pick the other reading of an ambiguous wall time.
 * - A `relativeTo` string is ISO 8601 extended format before its first `[`:
 *   a date, a date-time, or with a time zone annotation a zoned date-time (`<date>T<time>`, then
 *   nothing, `Z` or `±HH:MM`). Basic format (`"20240101"`), a space or lower-case `t` separator, a
 *   lower-case `z`, a UTC offset without a zone and a zoned date without a time are invalid.
 * - A `relativeTo` string takes a calendar in RFC 9557 form, as `convertDateToCalendar` and
 *   `convertZonedToCalendar` write it: ISO digits and a `[u-ca=<id>]` annotation, after the zone
 *   for a zoned string (`"2024-02-24[u-ca=hebrew]"`, `"2024-02-24T00:00:00-05:00[America/New_York][u-ca=hebrew]"`).
 *   The annotations are read as Temporal reads them: the critical flag and the id's letter case
 *   are accepted, elective unknown annotations are ignored, the first `u-ca` names the calendar,
 *   and a string with a time zone annotation is zoned. An unknown critical annotation, a critical
 *   duplicate calendar, a calendar before the zone, an unsupported calendar and a leap second in
 *   any spelling return `""`.
 *   Compatibility: before 1.16.0 the digits were read as the calendar's own year, month and day.
 * - Returns "" for invalid input: non-string value, invalid duration string, or
 *   invalid relativeTo.
 *
 * @param value ISO 8601 duration string
 * @param options optional: { largestUnit, smallestUnit, roundingIncrement, roundingMode, relativeTo } per Temporal's Duration.round options
 * @returns rebalanced ISO 8601 duration string, or "" on invalid input
 *
 * @example normalizeDuration("PT90M", { largestUnit: "hour" }) // "PT1H30M"
 * @example normalizeDuration("PT90M30S", { smallestUnit: "minute" }) // "PT91M"
 * @example normalizeDuration("P45D", { largestUnit: "month" }) // "" (relativeTo required)
 * @example normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-01-01" }) // "P1M14D"
 * @example normalizeDuration("P45D", { largestUnit: "month", relativeTo: "20240101" }) // "" (basic format)
 * @example normalizeDuration("P1DT25H") // "P2DT1H"
 * @example normalizeDuration("PT2H", { smallestUnit: "minute", roundingIncrement: 60 }) // ""
 * @example normalizeDuration("PT25H", { largestUnit: "day", relativeTo: "2024-11-03T01:30[America/New_York]" }) // "P1D"
 * @example normalizeDuration("invalid") // ""
 * @example normalizeDuration("P400D", { largestUnit: "year", relativeTo: "2024-02-24[u-ca=hebrew]" }) // "P1Y15D" (Hebrew leap year 5784)
 * @example normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-02-10[!u-ca=hebrew]" }) // "P1M15D" (1 Adar I 5784; the critical flag is accepted)
 * @example normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-02-10T00:00:00[u-ca=hebrew]" }) // "P1M15D" (a date-time without a zone reads as its date, as Temporal reads relativeTo)
 */
export function normalizeDuration(
  value: string,
  options?: {
    largestUnit?: Temporal.LargestUnit<Temporal.DateTimeUnit>;
    smallestUnit?: Temporal.SmallestUnit<Temporal.DateTimeUnit>;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
    relativeTo?: DurationRelativeTo;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  try {
    const duration = Temporal.Duration.from(value);
    return durationRound(duration, {
      largestUnit: options?.largestUnit ?? "auto",
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
      relativeTo: resolveDurationRelativeTo(options?.relativeTo),
    }).toString();
  } catch {
    return "";
  }
}
