// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import {
  addToZonedDisambiguated,
  calendarSystemOfZonedValue,
  formatZonedInCalendar,
  isValidAmount,
  parseCalendarZonedValue,
  resolveOverflow,
} from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  Disambiguation,
  Overflow,
} from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Subtract a temporal amount from a zoned ISO 8601 datetime string and return a zoned ISO 8601 string.
 *
 * - Uses Temporal.ZonedDateTime.subtract to subtract duration.
 * - Validates duration units and values.
 * - Accepts an RFC 9557 calendar-annotated zoned string (as `convertZonedToCalendar` writes it,
 *   e.g. `"2024-03-25T14:30:00-04:00[America/New_York][u-ca=hebrew]"`), not just a bare ISO string
 *   (E7, issue #152). Calendar-unit arithmetic ("subtract 1 month") resolves against that calendar
 *   **and** the DST rules of the zone, in one operation; the result carries the same calendar
 *   annotation. A bare ISO string is the `"iso8601"` calendar and returns a bare ISO string.
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 * - Follows Temporal's AddZonedDateTime: the date portion of the duration (years, months, weeks,
 *   days) moves the wall-clock date, then the time portion (hours and smaller) is subtracted in exact
 *   time. `disambiguation` ("compatible" (default), "earlier", "later", or "reject" (returns
 *   "")) applies ONLY to the intermediate wall-clock date-time after the date portion, exactly as
 *   Temporal's GetEpochNanosecondsFor resolves it: in a fall-back (DST-end) overlap "compatible"
 *   and "earlier" take the earlier instant and "later" the later one; in a spring-forward
 *   (DST-start) gap "compatible" and "later" move the wall clock forward by the gap length and
 *   "earlier" back by it; "reject" returns "" for both. It never re-resolves the exact-time
 *   result, so a time-only duration ignores it.
 * - Compatibility: before 1.16.0 a date portion landing in a spring-forward gap was always moved
 *   forward, whatever `disambiguation` said, so "earlier" matched "compatible" and "reject" did not
 *   fail. Pass "compatible" (or omit it) to keep the forward result.
 * - Compatibility: before 1.16.0 a non-"compatible" `disambiguation` re-resolved the final wall
 *   clock (so `- { minutes: 10 }` from `2024-11-03T01:30:00-05:00[America/New_York]` with
 *   "earlier" returned `01:20:00-04:00`, 70 minutes before the input in exact time, instead of
 *   `01:20:00-05:00`). To get that value, re-resolve the result's wall clock:
 *   `setZoned(result, { hour, minute, second }, { disambiguation, offset: "ignore" })`.
 * - There is no `offset` option (removed in 1.16.0): the intermediate wall clock is resolved from
 *   a plain date-time, which has no UTC offset for it to act on (Temporal
 *   `PlainDateTime#toZonedDateTime` reads only `disambiguation`).
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 *   1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string, optionally calendar-annotated
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject"), overflow ("constrain" | "reject")
 * @returns zoned ISO 8601 string on success, or "" on invalid input
 *
 * @example subtractZoned("2024-03-10T12:00:00-04:00[America/New_York]", { days: 5 }) // "2024-03-05T12:00:00-05:00[America/New_York]"
 * @example subtractZoned("invalid", { days: 5 }) // ""
 * @example subtractZoned("2024-11-04T01:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "later" }) // "2024-11-03T01:30:00-05:00[America/New_York]" (fall-back overlap resolved; default "compatible" would return the -04:00 instant instead)
 * @example subtractZoned("2024-11-04T01:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "" (fall-back overlap rejected)
 * @example subtractZoned("2024-03-11T02:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: "earlier" }) // "2024-03-10T01:30:00-05:00[America/New_York]" (02:30 on 10 March is in the spring-forward gap; "earlier" moves it back an hour, "compatible" forward to 03:30-04:00)
 * @example subtractZoned("2024-03-11T02:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "" (spring-forward gap rejected)
 * @example subtractZoned("2024-11-03T01:50:00-05:00[America/New_York]", { minutes: 10 }, { disambiguation: "earlier" }) // "2024-11-03T01:40:00-05:00[America/New_York]" (exact time — disambiguation never re-resolves it)
 * @example setZoned(subtractZoned("2024-11-03T01:50:00-05:00[America/New_York]", { minutes: 10 }), { hour: 1, minute: 40, second: 0 }, { disambiguation: "earlier", offset: "ignore" }) // "2024-11-03T01:40:00-04:00[America/New_York]" (pre-1.16.0 result)
 * @example subtractZoned("2024-03-31T12:00:00-04:00[America/New_York]", { months: 1 }, { overflow: "reject" }) // ""
 * @example subtractZoned("2024-03-25T14:30:00-04:00[America/New_York][u-ca=hebrew]", { months: 1 }) // "2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]" (Adar II -> Adar I, EDT -> EST in one call)
 * @example subtractZoned("2019-05-01T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]", { days: 1 }) // "2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]" (Reiwa 1 -> Heisei 31)
 * @example subtractZoned("2024-03-10T14:30:00-04:00[u-ca=hebrew][America/New_York]", { days: 1 }) // "" (calendar before zone is not RFC 9557)
 */
export function subtractZoned(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  optionsArg?: {
    disambiguation?: Disambiguation;
    overflow?: Overflow;
  },
): string {
  if (!isOptionsArgument(optionsArg)) {
    return "";
  }

  const validZonedDateTime = isValidCalendarZonedDateTime(value);
  const validUnits =
    typeof units === "object" &&
    units !== null &&
    Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = validUnits && Object.values(units).every(isValidAmount);

  if (!validZonedDateTime || !validUnits || !validAmounts) {
    return "";
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const overflow = resolveOverflow(optionsArg?.overflow);

  try {
    const calendar = calendarSystemOfZonedValue(value);
    if (!calendar) {
      return "";
    }
    const zoned = parseCalendarZonedValue(value);
    const subtracted = addToZonedDisambiguated(zoned, units, -1, {
      overflow,
      disambiguation,
    });
    return formatZonedInCalendar(subtracted, calendar);
  } catch {
    return "";
  }
}
