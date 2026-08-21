import { Temporal } from "@js-temporal/polyfill";
import type { DurationRelativeTo } from "../../types";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Compare two ISO 8601 duration strings by length.
 *
 * - Uses Temporal.Duration.compare: -1 when `a` is shorter, 0 when equal, 1 when `a` is longer.
 * - Equality is by length, not by spelling — "PT60M" and "PT1H" compare 0, as do "P1D" and
 *   "PT24H" absent a `relativeTo`.
 * - `relativeTo` is required whenever a calendar unit (year/month/week) appears on either
 *   side; without it, returns null. Note the asymmetry with `addDuration`/`subtractDuration`
 *   (A2): Temporal.Duration.compare *does* accept `relativeTo`, while .add/.subtract do not,
 *   so calendar-unit durations are comparable here even though they cannot be combined there.
 *   `durationAs` and `normalizeDuration` (A3) carry the same relativeTo rule as this function.
 * - The anchor genuinely decides the answer rather than merely unblocking it: "P1M" is longer
 *   than "P30D" relative to January (31 days) and shorter relative to February 2024 (29).
 * - It matters for non-calendar units too when it names a zoned instant — across a DST
 *   spring-forward, "P1D" is 23 real hours and so compares shorter than "PT24H".
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
 * @example compareDurations("not a duration", "PT1H") // null
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
    return Temporal.Duration.compare(a, b, {
      relativeTo: options?.relativeTo,
    });
  } catch {
    return null;
  }
}
