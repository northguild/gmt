import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Restrict `value` to the range [`min`, `max`] in zoned datetime space.
 *
 * - Returns `value` if it falls within the bounds (inclusive on both ends).
 * - Returns `min` if `value` is before `min`.
 * - Returns `max` if `value` is after `max`.
 * - Returns `""` if any input is invalid or `min > max`.
 *
 * @param value ISO ZonedDateTime string to clamp
 * @param min ISO ZonedDateTime string for the lower bound (inclusive)
 * @param max ISO ZonedDateTime string for the upper bound (inclusive)
 * @returns The clamped zoned datetime string, or "" on invalid input
 *
 * @example clampZoned("2024-03-15T12:00:00+00:00[UTC]", "2024-03-01T00:00:00+00:00[UTC]", "2024-03-31T23:59:59+00:00[UTC]") // "2024-03-15T12:00:00+00:00[UTC]"
 * @example clampZoned("2024-02-01T12:00:00+00:00[UTC]", "2024-03-01T00:00:00+00:00[UTC]", "2024-03-31T23:59:59+00:00[UTC]") // "2024-03-01T00:00:00+00:00[UTC]"
 * @example clampZoned("2024-05-01T12:00:00+00:00[UTC]", "2024-03-01T00:00:00+00:00[UTC]", "2024-03-31T23:59:59+00:00[UTC]") // "2024-03-31T23:59:59+00:00[UTC]"
 * @example clampZoned("2024-03-15T12:00:00+00:00[UTC]", "2024-03-31T00:00:00+00:00[UTC]", "2024-03-01T00:00:00+00:00[UTC]") // ""
 * @example clampZoned("invalid", "2024-03-01T00:00:00+00:00[UTC]", "2024-03-31T23:59:59+00:00[UTC]") // ""
 */
export function clampZoned(value: string, min: string, max: string): string {
  if (
    !isValidZonedDateTime(value) ||
    !isValidZonedDateTime(min) ||
    !isValidZonedDateTime(max)
  ) {
    return "";
  }

  try {
    const v = Temporal.ZonedDateTime.from(value);
    const mn = Temporal.ZonedDateTime.from(min);
    const mx = Temporal.ZonedDateTime.from(max);

    if (Temporal.ZonedDateTime.compare(mn, mx) === 1) {
      return "";
    }

    const cmpMin = Temporal.ZonedDateTime.compare(v, mn);
    const cmpMax = Temporal.ZonedDateTime.compare(v, mx);

    if (cmpMin < 0) {
      return mn.toString();
    }
    if (cmpMax > 0) {
      return mx.toString();
    }

    return v.toString();
  } catch {
    return "";
  }
}
