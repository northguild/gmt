import { durationCompare, resolveDurationRelativeTo } from "../../internal";
import type { DurationRelativeTo } from "../../types";
import { isValidDuration } from "../validate/isValidDuration";

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
 * - A `relativeTo` string takes a calendar only in GMT's PlainDate shape
 *   (`"5784-06-15[u-ca=hebrew]"`, calendar-native digits). Any other `[u-ca=...]` spelling — a
 *   critical flag, an upper-case id, a trailing annotation, a date-time or zoned string —
 *   returns null, as does a leap second in any spelling, rather than being read with Temporal's
 *   ISO digits or clamped to `:59`. Compatibility: for Temporal's ISO-digit reading, convert the
 *   ISO date first with `convertDateToCalendar(isoDate, calendar)`, or pass a Temporal object.
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
 * @example compareDurations("P1D", "PT24H", { relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]" }) // -1 (spring-forward)
 * @example compareDurations("P1Y", "P1Y") // 0
 * @example compareDurations("P1D", "PT24H", { relativeTo: "2024-11-03T01:30[America/New_York]" }) // 1
 * @example compareDurations("not a duration", "PT1H") // null
 * @example compareDurations("P1M", "P30D", { relativeTo: "5785-04-15[u-ca=hebrew]" }) // -1 (Tevet, a 29-day Hebrew month — relativeTo accepts GMT's calendar-annotated PlainDate string, not Temporal's own ISO-digit u-ca convention)
 * @example compareDurations("P1M", "P30D", { relativeTo: "2024-02-10[!u-ca=hebrew]" }) // null (critical flag — not GMT's calendar shape)
 * @example compareDurations("P1M", "P30D", { relativeTo: convertDateToCalendar("2024-02-10", "hebrew") }) // 0 (Temporal's ISO-digit reading of the same tag)
 */
export function compareDurations(
  a: string,
  b: string,
  options?: { relativeTo?: DurationRelativeTo },
): number | null {
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
