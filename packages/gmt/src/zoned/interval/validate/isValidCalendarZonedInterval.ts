import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarZonedValue } from "../../../internal";

/**
 * Return true if `start` and `end` form a valid GMT zoned interval — both parseable as bare ISO
 * or GMT calendar-annotated ZonedDateTime strings, and the instant at `start` is <= the instant
 * at `end`.
 *
 * - Parallel to `isValidZonedInterval`, which is deliberately left unchanged and still rejects
 *   every `[u-ca=...]` annotation (E7, issue #152). Only the calendar-aware `zoned/interval/*`
 *   functions gate on this one.
 * - **Mixed calendars are accepted** (E7's D4-zoned, matching E5's D4): ordering is
 *   calendar-independent. Verified against `@js-temporal/polyfill@0.5.1` —
 *   `Temporal.Instant` carries no calendar field at all, and `ZonedDateTime.compare` /
 *   `Instant.compare` both return `0` for the same instant expressed in hebrew, islamic-civil,
 *   japanese and iso8601. A Hebrew start with an Islamic end is a well-formed interval.
 * - Equal `start === end` is valid.
 * - Comparison is done by instant, so intervals spanning DST transitions are compared by
 *   absolute time.
 * - Rejects Temporal's `[timeZone][u-ca=...]` ordering, leap seconds, non-strings, and any
 *   unparseable endpoint.
 *
 * @param start ISO or GMT calendar-annotated ZonedDateTime string (interval start)
 * @param end ISO or GMT calendar-annotated ZonedDateTime string (interval end)
 * @returns true if start and end form a valid zoned interval, or false on invalid input
 *
 * @example isValidCalendarZonedInterval("2024-01-01T10:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // true
 * @example isValidCalendarZonedInterval("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]", "5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]") // true
 * @example isValidCalendarZonedInterval("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]", "1445-09-15T14:30:00-04:00[u-ca=islamic-civil][America/New_York]") // true (mixed calendars accepted)
 * @example isValidCalendarZonedInterval("2024-12-31T23:59:59+00:00[UTC]", "2024-01-01T10:00:00+00:00[UTC]") // false (start after end)
 * @example isValidCalendarZonedInterval("2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]", "2024-12-31T23:59:59+00:00[UTC]") // false (Temporal's segment ordering)
 * @example isValidCalendarZonedInterval("invalid", "2024-12-31T23:59:59+00:00[UTC]") // false
 */
export function isValidCalendarZonedInterval(
  start: string,
  end: string,
): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  try {
    const startInstant = parseCalendarZonedValue(start).toInstant();
    const endInstant = parseCalendarZonedValue(end).toInstant();

    return Temporal.Instant.compare(startInstant, endInstant) <= 0;
  } catch {
    return false;
  }
}
