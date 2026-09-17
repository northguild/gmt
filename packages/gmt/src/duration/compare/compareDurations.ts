import { durationCompare, resolveDurationRelativeTo } from "../../internal";
import type { DurationRelativeTo } from "../../types";
import { isValidDuration } from "../validate/isValidDuration";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Compare two ISO 8601 duration strings by length.
 *
 * - Uses Temporal.Duration.compare: -1 when `a` is shorter, 0 when equal, 1 when `a` is longer.
 * - Equality is by length, not by spelling — "PT60M" and "PT1H" compare 0, as do "P1D" and
 *   "PT24H" absent a `relativeTo`.
 * - `relativeTo` is required whenever a calendar unit (year/month/week) appears on either
 *   side and the two durations differ; without it, returns null. Field-identical durations
 *   compare 0 without it ("P1Y" vs "P1Y"), since Temporal checks identity first. Note the asymmetry with `addDuration`/`subtractDuration`
 *   (A2): Temporal.Duration.compare *does* accept `relativeTo`, while .add/.subtract do not,
 *   so calendar-unit durations are comparable here even though they cannot be combined there.
 *   `durationAs` and `normalizeDuration` (A3) carry the same relativeTo rule as this function.
 * - The anchor genuinely decides the answer rather than merely unblocking it: "P1M" is longer
 *   than "P30D" relative to January (31 days) and shorter relative to February 2024 (29).
 * - It matters for non-calendar units too when it names a zoned instant — across a DST
 *   spring-forward, "P1D" is 23 real hours and so compares shorter than "PT24H".
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
 * - Returns null if either operand is not a valid ISO 8601 duration string, or `relativeTo`
 *   is invalid.
 *
 * @param a ISO 8601 duration string
 * @param b ISO 8601 duration string
 * @param options optional: { relativeTo } — anchor date/instant, required when either side has a calendar unit
 * @returns -1, 0, or 1, or null on invalid input
 *
 * @example compareDurations("PT1H", "PT30M") // 1
 * @example compareDurations("PT60M", "PT1H") // 0
 * @example compareDurations("-PT1H", "PT1H") // -1
 * @example compareDurations("P1M", "P30D") // null (calendar unit needs relativeTo)
 * @example compareDurations("P1M", "P30D", { relativeTo: "2024-01-01" }) // 1
 * @example compareDurations("P1M", "P30D", { relativeTo: "2024-02-01" }) // -1
 * @example compareDurations("P1M", "P30D", { relativeTo: "2024-02-01 00:00" }) // null (space separator)
 * @example compareDurations("P1D", "PT24H", { relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]" }) // -1 (spring-forward)
 * @example compareDurations("P1Y", "P1Y") // 0
 * @example compareDurations("P1D", "PT24H", { relativeTo: "2024-11-03T01:30[America/New_York]" }) // 1
 * @example compareDurations("not a duration", "PT1H") // null
 * @example compareDurations("P1M", "P30D", { relativeTo: "2025-01-15[u-ca=hebrew]" }) // -1 (Tevet 5785, a 29-day Hebrew month)
 * @example compareDurations("P1M", "P30D", { relativeTo: "2024-02-10[!u-ca=hebrew]" }) // 0 (1 Adar I 5784, a 30-day month; the critical flag is accepted)
 * @example compareDurations("P1M", "P30D", { relativeTo: "2024-02-10T00:00:00[u-ca=hebrew]" }) // 0 (a date-time without a zone reads as its date, as Temporal reads relativeTo)
 */
export function compareDurations(
  a: string,
  b: string,
  options?: { relativeTo?: DurationRelativeTo },
): number | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  if (!isValidDuration(a) || !isValidDuration(b)) {
    return null;
  }

  try {
    return durationCompare(
      a,
      b,
      resolveDurationRelativeTo(options?.relativeTo),
    );
  } catch {
    return null;
  }
}
