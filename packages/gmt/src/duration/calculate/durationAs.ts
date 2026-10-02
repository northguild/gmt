import { Temporal } from "@js-temporal/polyfill";
import { durationTotal, resolveDurationRelativeTo } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, DurationRelativeTo } from "../../types";
import { isValidDuration } from "../validate/isValidDuration";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Express an ISO 8601 duration as a single fractional total in one unit.
 *
 * - Uses Temporal.Duration.from and .total — the whole duration is converted, so
 *   durationAs("P1DT2H30M", "hours") is 26.5, not the 2 that `getDurationUnit` reads.
 * - The result is fractional, not rounded: durationAs("P1DT2H30M", "days") is
 *   1.1041666666666667. Round it yourself, or reach for `normalizeDuration` instead.
 * - The calendar-unit rule of `relativeTo` is the same one `normalizeDuration` (A3) carries;
 *   `addDuration`/`subtractDuration` (A2) have it worse still, since Temporal gives them no
 *   `relativeTo` option at all.
 * - The requested-unit half of that rule bites even on day/time-only input: "P1DT2H30M" has
 *   no calendar component, yet durationAs("P1DT2H30M", "weeks") is still null — a week is a
 *   calendar quantity to Temporal regardless of what it is being measured from.
 * - A zoned `relativeTo` string resolves its wall time with disambiguation "compatible" and
 *   offset "reject", as Temporal does: an ambiguous wall time takes the earlier instant, a
 *   nonexistent one the later instant, and an offset that does not match the zone returns null.
 *   Pass an explicit offset to pick the other reading of an ambiguous wall time.
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
 *   any spelling return null.
 *   Compatibility: before 1.16.0 the digits were read as the calendar's own year, month and day.
 * - `unit` accepts the plural or singular name (`"hours"` or `"hour"`), as Temporal does.
 * - Returns null on a non-duration `value`, an invalid `unit`, or an invalid `relativeTo`.
 *
 * @param value ISO 8601 duration string
 * @param unit DateTimeDurationUnit to total into ("years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds", or the singular name)
 * @param options The anchor calendar units are measured from
 * @returns the fractional total in `unit`, or null on invalid input
 *
 * @example durationAs("P1DT2H30M", "hours") // 26.5
 * @example durationAs("P1DT2H30M", "minutes") // 1590
 * @example durationAs("PT36H", "days") // 1.5
 * @example durationAs("-PT90M", "hours") // -1.5
 * @example durationAs("P1M", "days") // null (calendar unit needs relativeTo)
 * @example durationAs("P1M", "days", { relativeTo: "2024-02-01" }) // 29
 * @example durationAs("P1M", "days", { relativeTo: "20240201" }) // null (basic format)
 * @example durationAs("P1D", "hours", { relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]" }) // 23 (spring-forward)
 * @example durationAs("P1D", "hours", { relativeTo: "2024-11-03T01:30[America/New_York]" }) // 25
 * @example durationAs("P1DT2H30M", "minute") // 1590 (singular unit name)
 * @example durationAs("not a duration", "hours") // null
 * @example durationAs("P1Y", "days", { relativeTo: "2024-02-24[u-ca=hebrew]" }) // 385 (Hebrew leap year 5784)
 * @example durationAs("P1M", "days", { relativeTo: "2024-02-10[!u-ca=hebrew]" }) // 30 (1 Adar I 5784; the critical flag is accepted)
 * @example durationAs("P1M", "days", { relativeTo: "2024-02-10T00:00:00[u-ca=hebrew]" }) // 30 (a date-time without a zone reads as its date, as Temporal reads relativeTo)
 */
export function durationAs(
  value: string,
  unit: DateTimeDurationUnit | Temporal.DateTimeUnit,
  options?: {
    /**
     * The date or zoned date-time the duration is measured from. It is required whenever a year,
     * month or week is involved, as the `unit` asked for or as a nonzero field of the duration.
     * With a zoned value, days follow that zone's clock changes, so a day spanning a
     * spring-forward transition totals 23 hours.
     *
     * @defaultValue None. Days are 24 hours, and a duration or `unit` that involves a year, month
     * or week returns `null`.
     */
    relativeTo?: DurationRelativeTo;
  },
): number | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  const resolvedUnit = resolveDurationUnit(unit);

  if (!isValidDuration(value) || !isValidDateTimeDurationUnit(resolvedUnit)) {
    return null;
  }

  try {
    return durationTotal(
      Temporal.Duration.from(value),
      resolvedUnit,
      resolveDurationRelativeTo(options?.relativeTo),
    );
  } catch {
    return null;
  }
}
