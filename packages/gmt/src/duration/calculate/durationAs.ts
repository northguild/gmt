import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, DurationRelativeTo } from "../../types";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Express an ISO 8601 duration as a single fractional total in one unit.
 *
 * - Uses Temporal.Duration.from and .total — the whole duration is converted, so
 *   durationAs("P1DT2H30M", "hours") is 26.5, not the 2 that `getDurationUnit` reads.
 * - The result is fractional, not rounded: durationAs("P1DT2H30M", "days") is
 *   1.1041666666666667. Round it yourself, or reach for `normalizeDuration` instead.
 * - `relativeTo` is required whenever a calendar unit (year/month/week) is involved, in
 *   *either* direction — as the requested `unit`, or because the input duration already has
 *   a nonzero year/month/week component. Without it, returns null. This is the same
 *   documented gap `normalizeDuration` (A3) carries; `addDuration`/`subtractDuration` (A2)
 *   have it worse still, since Temporal gives them no `relativeTo` option at all.
 * - The requested-unit half of that rule bites even on day/time-only input: "P1DT2H30M" has
 *   no calendar component, yet durationAs("P1DT2H30M", "weeks") is still null — a week is a
 *   calendar quantity to Temporal regardless of what it is being measured from.
 * - `relativeTo` changes the answer for non-calendar units too when it names a zoned instant:
 *   a day spanning a DST spring-forward transition totals 23 hours, not 24.
 * - Returns null on a non-duration `value`, an invalid `unit`, or an invalid `relativeTo`.
 *
 * @param value ISO 8601 duration string
 * @param unit DateTimeDurationUnit to total into ("years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds")
 * @param options optional: { relativeTo } — anchor date/instant, required for any calendar unit
 * @returns the fractional total in `unit`, or null on invalid input
 *
 * @example durationAs("P1DT2H30M", "hours") // 26.5
 * @example durationAs("P1DT2H30M", "minutes") // 1590
 * @example durationAs("PT36H", "days") // 1.5
 * @example durationAs("-PT90M", "hours") // -1.5
 * @example durationAs("P1M", "days") // null (calendar unit needs relativeTo)
 * @example durationAs("P1M", "days", { relativeTo: "2024-02-01" }) // 29
 * @example durationAs("P1D", "hours", { relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]" }) // 23 (spring-forward)
 * @example durationAs("not a duration", "hours") // null
 */
export function durationAs(
  value: string,
  unit: DateTimeDurationUnit,
  options?: { relativeTo?: DurationRelativeTo },
): number | null {
  if (!isValidDuration(value) || !isValidDateTimeDurationUnit(unit)) {
    return null;
  }

  try {
    return Temporal.Duration.from(value).total({
      unit,
      relativeTo: options?.relativeTo,
    });
  } catch {
    return null;
  }
}
