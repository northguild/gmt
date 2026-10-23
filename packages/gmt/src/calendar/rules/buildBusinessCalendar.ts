import { parseWeekend } from "../../internal/businessCalendar";
import { isoDateString } from "../../internal/epochDay";
import {
  buildHolidayEpochDays,
  parseHolidayRule,
  type ResolvedHolidayRule,
} from "../../internal/holidayRules";
import { isZoneId } from "../../internal/inputChecks";
import { isObject } from "../../internal/isObject";
import type { BusinessCalendar, BusinessCalendarSpec } from "../../types";

/** Temporal's ISO year range: -271821-04-19 to +275760-09-13 (TC39 ISODateWithinLimits). */
const MIN_YEAR = -271_821;
const MAX_YEAR = 275_760;
/** One Gregorian cycle: weekdays and Easter-free rules repeat exactly; it bounds the loop. */
const MAX_YEARS = 400;

/** True when `value` is an integer in Temporal's year range; false for NaN and the infinities. */
function isYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_YEAR &&
    value <= MAX_YEAR
  );
}

/**
 * Expand holiday rules into a `BusinessCalendar` for a range of years.
 *
 * - Every holiday that does not walk is placed first. Then each rule's `nextWorkingDay` shifts
 *   walk, in list order, past the weekend, those holidays and the walks of the rules before it.
 *   The days that close do not depend on the order; it decides only which holiday takes which day.
 * - A moved holiday closes only its observed day. To close both, list the rule twice, once
 *   without `observed`.
 * - A holiday observed on a day outside `years` is not in the result; a holiday from the year
 *   before or after `years` that is observed inside it is.
 * - A year's holidays do not depend on the window: the build expands enough years before and
 *   one after `years` to see every shift that reaches into it.
 * - At most 400 years (one Gregorian cycle). The calendar is built in a single pass over the
 *   rules and years; nothing is cached between calls.
 * - Never throws.
 *
 * @param spec the zone, weekend, rules and inclusive range of ISO years
 * @returns the calendar, or `null` when any part of `spec` is invalid, the range exceeds 400 years, a `nextWorkingDay` shift moves a holiday more than 31 days (the check also covers the years just outside `years`: `years: { from: 2027, to: 2027 }` gives `null` for a 45-day shift in March 2026), or a shift inside `years` leaves Temporal's range
 *
 * @example buildBusinessCalendar({ timeZone: "Europe/Berlin", weekend: [6, 7], years: { from: 2026, to: 2026 }, rules: [{ name: "New year", kind: "fixed", month: 1, day: 1 }, { name: "Two days before Easter", kind: "easterRelative", offsetDays: -2 }, { name: "Day after Easter", kind: "easterRelative", offsetDays: 1 }, { name: "Spring day", kind: "fixed", month: 5, day: 1 }, { name: "Winter day", kind: "fixed", month: 12, day: 25 }, { name: "Day after winter day", kind: "fixed", month: 12, day: 26 }] }) // { weekend: [6, 7], holidays: ["2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25", "2026-12-26"], timeZone: "Europe/Berlin" } — six fixed and Easter-relative closing days
 * @example buildBusinessCalendar({ timeZone: "UTC", weekend: [6, 7], years: { from: 2021, to: 2021 }, rules: [{ name: "a", kind: "fixed", month: 12, day: 25, observed: { 6: "nextWorkingDay", 7: "nextWorkingDay" } }, { name: "b", kind: "fixed", month: 12, day: 26, observed: { 6: "nextWorkingDay", 7: "nextWorkingDay" } }] })?.holidays // ["2021-12-27", "2021-12-28"] — the second shift passes the first, in either order
 * @example buildBusinessCalendar({ timeZone: "UTC", weekend: [6, 7], rules: [], years: { from: 2027, to: 2026 } }) // null — from is after to
 */
export function buildBusinessCalendar(
  spec: BusinessCalendarSpec,
): BusinessCalendar | null {
  try {
    if (!isObject(spec) || Array.isArray(spec)) {
      return null;
    }

    const { timeZone, weekend, rules, years } = spec as Record<string, unknown>;

    if (typeof timeZone !== "string" || !isZoneId(timeZone)) {
      return null;
    }

    const weekendDays = parseWeekend(weekend);

    if (weekendDays === null || !Array.isArray(rules)) {
      return null;
    }

    const resolvedRules: ResolvedHolidayRule[] = [];

    for (let index = 0; index < rules.length; index++) {
      const resolved = parseHolidayRule(rules[index]);

      if (resolved === null) {
        return null;
      }

      resolvedRules.push(resolved);
    }

    if (!isObject(years) || Array.isArray(years)) {
      return null;
    }

    const { from, to } = years as Record<string, unknown>;

    if (!isYear(from) || !isYear(to) || from > to || to - from >= MAX_YEARS) {
      return null;
    }

    const days = buildHolidayEpochDays(resolvedRules, weekendDays, from, to);

    if (days === null) {
      return null;
    }

    return {
      weekend: [...weekendDays].sort((a, b) => a - b),
      holidays: Array.from(days, isoDateString),
      timeZone,
    };
  } catch {
    // Never throws (Core Rule 3): a hostile spec or an unreadable calendar is an invalid spec.
    return null;
  }
}
