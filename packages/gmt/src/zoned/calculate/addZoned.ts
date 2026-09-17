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
  Offset,
  Overflow,
} from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Add a temporal amount to a zoned ISO 8601 datetime string and return a zoned ISO 8601 string.
 *
 * - Uses Temporal.ZonedDateTime.add to add duration.
 * - Validates duration units and values.
 * - Accepts a GMT calendar-annotated zoned string (as produced by `convertZonedToCalendar`, e.g.
 *   `"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"`), not just a bare ISO string —
 *   E7 (issue #152). Calendar-unit arithmetic ("add 1 month") resolves against that calendar (a
 *   Hebrew leap month, an Ethiopic Pagumen, a Japanese era change) **and** the DST rules of the
 *   zone, in one operation. The calendar tag, the era, the wall time and the UTC offset are all
 *   re-derived from the result, never copied from the input — Hebrew Adar I 15 in
 *   `America/New_York` `+1 month` moves both the month (Adar I -> Adar) and the offset
 *   (-05:00 -> -04:00). A bare ISO string is unaffected — always treated as, and always returns,
 *   `"gregorian"`.
 * - Follows Temporal's AddZonedDateTime: the date portion of the duration (years, months, weeks,
 *   days) moves the wall-clock date, then the time portion (hours and smaller) is added in exact
 *   time. `disambiguation` ("compatible" (default), "earlier", "later", or "reject" (returns
 *   "")) applies ONLY to the intermediate wall-clock date-time after the date portion, when
 *   that lands on an ambiguous local time from a fall-back (DST-end) overlap. It never re-resolves
 *   the exact-time result, so a time-only duration ignores it. Has no effect when the date step
 *   lands in a spring-forward (DST-start) gap — the gap landing is always advanced past.
 * - Compatibility: before 1.16.0 a non-"compatible" `disambiguation` re-resolved the final wall
 *   clock (so `+ { minutes: 10 }` from `01:30-05:00` with "earlier" returned `01:40-04:00`, 50
 *   minutes earlier in exact time). To get that value, re-resolve the result's wall clock:
 *   `setZoned(result, { hour, minute, second }, { disambiguation, offset: "ignore" })`.
 * - `offset` ("prefer" | "use" | "ignore" (default) | "reject") is accepted for API consistency with
 *   sibling zoned-construction functions (see `startOfZoned`, `endOfZoned`, etc.) but has **no effect
 *   here**: the internal rebuild step reconstructs from a plain datetime string with no UTC offset
 *   embedded, so there is never a stored offset for `offset` to prefer/use/ignore/reject against.
 *   `disambiguation` is the only option that affects this function's output.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 *   to Jan 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string, optionally calendar-annotated
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject" — accepted but inert, see above), overflow ("constrain" | "reject")
 * @returns zoned ISO 8601 string on success, or "" on invalid input
 *
 * @example addZoned("2024-02-29T14:30:45.123-05:00[America/New_York]", { days: 1 }) // "2024-03-01T14:30:45.123-05:00[America/New_York]"
 * @example addZoned("invalid", { days: 1 }) // ""
 * @example addZoned("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]", { months: 1 }) // "5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]" (Adar I -> Adar, EST -> EDT in one call)
 * @example addZoned("0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]", { days: 1 }) // "0001-05-01T12:00:00+09:00[u-ca=japanese;era=reiwa][Asia/Tokyo]" (era re-derived, not copied)
 * @example addZoned("7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]", { months: 1 }, { overflow: "reject" }) // "" (day 30 does not exist in the 5-day Pagumen)
 * @example addZoned("2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]", { days: 1 }) // "" (Temporal's segment ordering is not GMT's grammar)
 * @example addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: "later" }) // "2024-11-03T01:30:00-05:00[America/New_York]" (fall-back overlap resolved; default "compatible" would return the -04:00 instant instead)
 * @example addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "" (fall-back overlap rejected)
 * @example addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }) // "2024-03-10T03:30:00-04:00[America/New_York]" (spring-forward gap — disambiguation has no effect, arithmetic already advanced past it, so "reject" does not throw here)
 * @example addZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minutes: 10 }, { disambiguation: "earlier" }) // "2024-11-03T01:40:00-05:00[America/New_York]" (exact time — disambiguation never re-resolves it)
 * @example setZoned(addZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minutes: 10 }), { hour: 1, minute: 40, second: 0 }, { disambiguation: "earlier", offset: "ignore" }) // "2024-11-03T01:40:00-04:00[America/New_York]" (pre-1.16.0 result)
 * @example addZoned("2024-01-31T12:00:00-05:00[America/New_York]", { months: 1 }, { overflow: "reject" }) // ""
 */
export function addZoned(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  optionsArg?: {
    disambiguation?: Disambiguation;
    offset?: Offset;
    overflow?: Overflow;
  },
): string {
  const validZonedDateTime = isValidCalendarZonedDateTime(value);
  const validUnits =
    typeof units === "object" &&
    units !== null &&
    Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = validUnits && Object.values(units).every(isValidAmount);

  if (!validZonedDateTime || !validUnits || !validAmounts) {
    // TODO descriptive messages of what failed - likely could be GMT offset for historical changes and DST
    return "";
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";
  const overflow = resolveOverflow(optionsArg?.overflow);

  try {
    const calendar = calendarSystemOfZonedValue(value);
    if (!calendar) {
      return "";
    }
    const zoned = parseCalendarZonedValue(value);
    const added = addToZonedDisambiguated(zoned, units, 1, {
      overflow,
      disambiguation,
      offset,
    });
    return formatZonedInCalendar(added, calendar);
  } catch {
    return "";
  }
}
