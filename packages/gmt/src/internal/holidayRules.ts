import type { EasterComputus } from "../types/holiday-rule";
import {
  parseHolidays,
  resolveParts,
  type ResolvedBusinessCalendar,
} from "./businessCalendar";
import {
  canonicalCalendarSystem,
  computationCalendarId,
} from "./calendarSystemIds";
import { easterEpochDay } from "./easter";
import {
  epochDayOf,
  epochDayOfDate,
  isoDateString,
  isoWeekdayOf,
  lowerBound,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
  sortedUnique,
} from "./epochDay";
import { isObject } from "./isObject";
import { isValidDayOfWeek } from "./isValidDayOfWeek";
import {
  isWeekdayOrdinal,
  nthWeekdayEpochDay,
  ordinalNumber,
} from "./nthWeekday";
import {
  observedEpochDay,
  parseObservancePolicy,
  policyNeedsCalendar,
  type ResolvedObservancePolicy,
} from "./observance";
import { Temporal } from "./temporal";
import { calendarDateFromMonthCode, calendarFieldsOf } from "./temporalCompat";

/** Temporal's ISO year range (TC39 ISODateWithinLimits): -271821-04-19 to +275760-09-13. */
const MIN_YEAR = -271_821;
const MAX_YEAR = 275_760;
/** Mean Gregorian year, to estimate which computus year a date offset from Easter falls in. */
const MEAN_YEAR_DAYS = 365.2425;
/** Day of year of Easter Sunday on average (about 10 April); only seeds the estimate. */
const EASTER_DAY_OF_YEAR = 100;
/** Rounds of re-estimating the computus year; the estimate settles or alternates within two. */
const ESTIMATE_ROUNDS = 4;
/** The estimate is off by at most one computus year; two either side is a safe margin. */
const CANDIDATE_MARGIN = 2;
/** An Islamic year is 354 days, so a 366-day window touches at most three calendar years. */
const MAX_CALENDAR_YEARS = 3;

const MONTH_CODE = /^M(0[1-9]|1[0-3])L?$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const THIRTEEN_MONTH_CALENDARS: ReadonlySet<string> = new Set([
  "coptic",
  "ethiopic",
  "ethioaa",
]);

type Observed = ResolvedObservancePolicy | null;

/** A `HolidayRule` after validation: numbers checked, calendar canonical, policy resolved, dates as epoch days. */
export type ResolvedHolidayRule =
  | { kind: "fixed"; month: number; day: number; policy: Observed }
  | {
      kind: "calendarFixed";
      calendarId: string;
      monthCode: string;
      day: number;
      policy: Observed;
    }
  | { kind: "nthWeekday"; month: number; weekday: number; n: number }
  | { kind: "easterRelative"; offsetDays: number; computus: EasterComputus }
  | { kind: "dates"; days: Int32Array };

function isIntegerIn(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}

/** Longest day count the month can have in any year: 29 for February. */
function maxDayOfMonth(month: number): number {
  return month === 2 ? 29 : DAYS_IN_MONTH[month - 1];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** `undefined` observed is no policy; anything else must be a valid one. `false` when invalid. */
function parseObserved(observed: unknown): Observed | false {
  if (observed === undefined) {
    return null;
  }

  return parseObservancePolicy(observed) ?? false;
}

/** The month codes Intl Era and Month Code `table-calendar-types` gives `canonical`. */
function isMonthCodeOf(canonical: string, monthCode: string): boolean {
  if (!MONTH_CODE.test(monthCode)) {
    return false;
  }
  if (monthCode.endsWith("L")) {
    return canonical === "hebrew" && monthCode === "M05L";
  }

  return monthCode !== "M13" || THIRTEEN_MONTH_CALENDARS.has(canonical);
}

function parseFixed(rule: Record<string, unknown>): ResolvedHolidayRule | null {
  const { month, day } = rule;

  if (
    !isIntegerIn(month, 1, 12) ||
    !isIntegerIn(day, 1, maxDayOfMonth(month))
  ) {
    return null;
  }

  const policy = parseObserved(rule.observed);

  return policy === false ? null : { kind: "fixed", month, day, policy };
}

function parseCalendarFixed(
  rule: Record<string, unknown>,
): ResolvedHolidayRule | null {
  const { calendar, monthCode, day } = rule;
  const canonical =
    typeof calendar === "string" ? canonicalCalendarSystem(calendar) : null;

  if (
    canonical === null ||
    typeof monthCode !== "string" ||
    !isMonthCodeOf(canonical, monthCode) ||
    !isIntegerIn(day, 1, 31)
  ) {
    return null;
  }

  const policy = parseObserved(rule.observed);

  return policy === false
    ? null
    : {
        kind: "calendarFixed",
        calendarId: computationCalendarId(canonical),
        monthCode,
        day,
        policy,
      };
}

function parseNthWeekday(
  rule: Record<string, unknown>,
): ResolvedHolidayRule | null {
  const { month, weekday, n } = rule;

  return isIntegerIn(month, 1, 12) &&
    typeof weekday === "number" &&
    isValidDayOfWeek(weekday) &&
    isWeekdayOrdinal(n)
    ? { kind: "nthWeekday", month, weekday, n: ordinalNumber(n) }
    : null;
}

function parseEasterRelative(
  rule: Record<string, unknown>,
): ResolvedHolidayRule | null {
  const { offsetDays, computus } = rule;

  return Number.isSafeInteger(offsetDays) &&
    (computus === undefined ||
      computus === "gregorian" ||
      computus === "julian")
    ? {
        kind: "easterRelative",
        offsetDays: offsetDays as number,
        computus: computus ?? "gregorian",
      }
    : null;
}

function parseDates(rule: Record<string, unknown>): ResolvedHolidayRule | null {
  const days = parseHolidays(rule.dates);

  return days === null ? null : { kind: "dates", days };
}

/**
 * Validate a caller-supplied `HolidayRule` and reduce it to what the expansion needs, or `null`
 * when it is not one. A `name` must be a string but is never output; properties a kind does not
 * define are ignored, as TC39 option reading ignores unknown keys. Reads the rule's properties,
 * so a hostile getter can throw: callers wrap this in `try`.
 */
export function parseHolidayRule(rule: unknown): ResolvedHolidayRule | null {
  if (!isObject(rule) || Array.isArray(rule)) {
    return null;
  }

  const fields = rule as Record<string, unknown>;

  if (typeof fields.name !== "string") {
    return null;
  }

  switch (fields.kind) {
    case "fixed":
      return parseFixed(fields);
    case "calendarFixed":
      return parseCalendarFixed(fields);
    case "nthWeekday":
      return parseNthWeekday(fields);
    case "easterRelative":
      return parseEasterRelative(fields);
    case "dates":
      return parseDates(fields);
    default:
      return null;
  }
}

/** True when the rule's policy shifts some weekday to `"nextWorkingDay"`, which needs a calendar. */
export function ruleNeedsCalendar(rule: ResolvedHolidayRule): boolean {
  return (
    (rule.kind === "fixed" || rule.kind === "calendarFixed") &&
    rule.policy !== null &&
    policyNeedsCalendar(rule.policy)
  );
}

/** Easter-relative days in `[first, last]`: at most five computus years are tried. */
function easterRelativeDays(
  rule: Extract<ResolvedHolidayRule, { kind: "easterRelative" }>,
  year: number,
  first: number,
  last: number,
): number[] {
  // The Julian-to-ISO drift belongs to the computus year being looked for, not to `year`: at an
  // offset of tens of millions of days the two differ by thousands of days. The estimate is
  // refined until it is stable; the drift moves by under 0.0075 days per year, so it settles in
  // two or three rounds, or, where the drift steps at a century, alternates between two adjacent
  // years. The true computus year is within one of either, which CANDIDATE_MARGIN covers.
  let estimate = year;

  for (let round = 0; round < ESTIMATE_ROUNDS; round++) {
    const drift =
      rule.computus === "julian"
        ? Math.floor(estimate / 100) - Math.floor(estimate / 400) - 2
        : 0;
    const next =
      year -
      Math.floor(
        (rule.offsetDays + EASTER_DAY_OF_YEAR + drift) / MEAN_YEAR_DAYS,
      );

    if (next === estimate) {
      break;
    }
    estimate = next;
  }

  const days: number[] = [];

  for (
    let computusYear = estimate - CANDIDATE_MARGIN;
    computusYear <= estimate + CANDIDATE_MARGIN;
    computusYear++
  ) {
    const easter = easterEpochDay(computusYear, rule.computus);
    const day = easter === null ? NaN : easter + rule.offsetDays;

    if (day >= first && day <= last) {
      days.push(day);
    }
  }

  return days;
}

/** Epoch days of a calendar-fixed date whose ISO date lies in `[first, last]`; `clipped` windows tolerate an unreadable edge year. */
function calendarFixedDays(
  rule: Extract<ResolvedHolidayRule, { kind: "calendarFixed" }>,
  first: number,
  last: number,
  clipped: boolean,
): number[] {
  const yearOf = (day: number): number =>
    calendarFieldsOf(
      Temporal.PlainDate.from(isoDateString(day)),
      rule.calendarId,
    ).year;
  const firstYear = yearOf(first);
  const lastYear = yearOf(last);

  if (lastYear - firstYear >= MAX_CALENDAR_YEARS) {
    throw new RangeError(
      "a year spans more calendar years than any calendar has",
    );
  }

  const days: number[] = [];

  for (let calendarYear = firstYear; calendarYear <= lastYear; calendarYear++) {
    let date: Temporal.PlainDate | null;

    try {
      date = calendarDateFromMonthCode(
        rule.calendarId,
        calendarYear,
        rule.monthCode,
        rule.day,
      );
    } catch (error) {
      // Only a window cut by a Temporal limit has an edge calendar year whose date can lie wholly
      // outside the range (a Hebrew Tishrei 1 before the minimum); in-range dates never throw.
      if (
        clipped &&
        error instanceof RangeError &&
        (calendarYear === firstYear || calendarYear === lastYear)
      ) {
        continue;
      }
      throw error;
    }

    const day = date === null ? NaN : epochDayOfDate(date);

    if (day >= first && day <= last) {
      days.push(day);
    }
  }

  return days;
}

/** `fixed`: the day when the month has it that year (RFC 5545 §3.3.10 / RFC 7529 §4.1: skipped, never clamped). */
function fixedDays(
  rule: Extract<ResolvedHolidayRule, { kind: "fixed" }>,
  year: number,
  first: number,
  last: number,
): number[] {
  if (rule.month === 2 && rule.day === 29 && !isLeapYear(year)) {
    return [];
  }

  const day = epochDayOf(year, rule.month, rule.day);

  return day >= first && day <= last ? [day] : [];
}

function nthWeekdayDays(
  rule: Extract<ResolvedHolidayRule, { kind: "nthWeekday" }>,
  year: number,
  first: number,
  last: number,
): number[] {
  const day = nthWeekdayEpochDay(year, rule.month, rule.weekday, rule.n);

  return day !== null && day >= first && day <= last ? [day] : [];
}

/** The listed dates inside `[first, last]`: a binary search to the start, then a scan. */
function listedDays(days: Int32Array, first: number, last: number): number[] {
  const found: number[] = [];

  for (
    let index = lowerBound(days, first);
    index < days.length && days[index] <= last;
    index++
  ) {
    found.push(days[index]);
  }

  return found;
}

/** The occurrences of a rule whose unshifted date lies in ISO `year`, as epoch days in ascending order. */
function occurrences(
  rule: ResolvedHolidayRule,
  year: number,
  first: number,
  last: number,
  clipped: boolean,
): number[] {
  switch (rule.kind) {
    case "fixed":
      return fixedDays(rule, year, first, last);
    case "nthWeekday":
      return nthWeekdayDays(rule, year, first, last);
    case "easterRelative":
      return easterRelativeDays(rule, year, first, last);
    case "calendarFixed":
      return calendarFixedDays(rule, first, last, clipped);
    case "dates":
      return listedDays(rule.days, first, last);
  }
}

/**
 * The observed day of each occurrence of the rule whose unshifted date lies in ISO `year` (the
 * occurrence itself when its policy does not move it), sorted, without repeats. Returns `null`
 * when a shift fails (no calendar for `nextWorkingDay`, out of range, or longer than
 * `maxShiftDays`). Throws a `RangeError` when a calendar cannot be read or a walk leaves
 * Temporal's range. `year` is an integer in -271821..275760, as every caller checks.
 *
 * With `skipOutOfRange` an occurrence whose observed day leaves Temporal's range is dropped
 * instead of failing the call (a walk that passes the limit counts the same way). A caller sets it
 * for a margin year, whose days can never fall inside the window it is building.
 */
export function holidayEpochDays(
  rule: ResolvedHolidayRule,
  year: number,
  calendar: ResolvedBusinessCalendar | null,
  maxShiftDays = Infinity,
  skipOutOfRange = false,
): number[] | null {
  if (!isIntegerIn(year, MIN_YEAR, MAX_YEAR)) {
    return [];
  }

  const yearFirst = epochDayOf(year, 1, 1);
  const yearLast = epochDayOf(year, 12, 31);
  const first = Math.max(yearFirst, MIN_EPOCH_DAY);
  const last = Math.min(yearLast, MAX_EPOCH_DAY);
  const found = occurrences(
    rule,
    year,
    first,
    last,
    first !== yearFirst || last !== yearLast,
  );

  if (
    (rule.kind !== "fixed" && rule.kind !== "calendarFixed") ||
    rule.policy === null
  ) {
    return found;
  }

  const observed: number[] = [];

  for (const day of found) {
    let moved: number | null;

    try {
      moved = observedEpochDay(day, rule.policy, calendar);
    } catch (error) {
      if (skipOutOfRange && error instanceof RangeError) {
        continue;
      }

      throw error;
    }

    // `{ next }` and `{ previous }` fail only by leaving the range; a `nextWorkingDay` walk that
    // fails inside it (no calendar, too many steps) fails in every year.
    if (
      moved === null &&
      skipOutOfRange &&
      rule.policy[isoWeekdayOf(day)] !== "nextWorkingDay"
    ) {
      continue;
    }

    if (moved === null || !(Math.abs(moved - day) <= maxShiftDays)) {
      return null;
    }

    observed.push(moved);
  }

  return Array.from(sortedUnique(Int32Array.from(observed)));
}

/**
 * The furthest a `nextWorkingDay` shift may move a holiday when a calendar is built (GMT rule).
 */
const MAX_SHIFT_DAYS = 31;

/** The fewest days in a year, so the margin bound below holds whichever years it spans. */
const DAYS_PER_YEAR = 365;

/**
 * Epoch days of every holiday the rules produce in years `from`..`to` (integers in
 * -271821..275760, `from <= to`, as the caller checks), sorted without repeats. Rules expand in
 * list order and each `nextWorkingDay` shift sees `weekend` plus every holiday the earlier rules
 * produced; only the result is clipped to the window and to Temporal's range. Returns `null`
 * when a shift fails or exceeds `MAX_SHIFT_DAYS` (in any expanded year) or a shift inside the
 * window leaves Temporal's range. Throws a `RangeError` when a calendar cannot be read.
 *
 * Margin. Years `to + 1` are expanded after the window: walks only move forward, and
 * `previous`/`next` shifts never read the calendar. Before the window `M` years are expanded,
 * `M = max(1, ceil(31 * (K + 1) / 365))` with `K` the rules that read the calendar. Each such
 * rule can push a changed day at most 31 days later, so a change that starts in year
 * `from - M - 1` (never expanded) moves at most 31 * (K + 1) days, which stays before `from`
 * while `31 * (K + 1) <= 365 * M`. `M` is 1 for ten rules or fewer. In a margin year an observed
 * day outside Temporal's range is dropped, since it could never fall in the window.
 *
 * Loop bound: rules x at most 400 + M + 1 years, plus one rebuild of the calendar per rule that
 * uses `nextWorkingDay` (and only when holidays were added since the last).
 */
export function buildHolidayEpochDays(
  rules: readonly ResolvedHolidayRule[],
  weekend: Set<number>,
  from: number,
  to: number,
): Int32Array | null {
  const windowFirst = Math.max(epochDayOf(from, 1, 1), MIN_EPOCH_DAY);
  const windowLast = Math.min(epochDayOf(to, 12, 31), MAX_EPOCH_DAY);
  const calendarRules = rules.filter(ruleNeedsCalendar).length;
  const margin = Math.max(
    1,
    Math.ceil((MAX_SHIFT_DAYS * (calendarRules + 1)) / DAYS_PER_YEAR),
  );
  const firstYear = Math.max(from - margin, MIN_YEAR);
  const lastYear = Math.min(to + 1, MAX_YEAR);
  const accumulated: number[] = [];
  let resolved: ResolvedBusinessCalendar | null = null;
  let dirty = true;

  for (const rule of rules) {
    if (dirty && ruleNeedsCalendar(rule)) {
      resolved = resolveParts(
        weekend,
        sortedUnique(Int32Array.from(accumulated)),
      );
      dirty = false;
    }

    for (let year = firstYear; year <= lastYear; year++) {
      const days = holidayEpochDays(
        rule,
        year,
        resolved,
        MAX_SHIFT_DAYS,
        year < from || year > to,
      );

      if (days === null) {
        return null;
      }

      for (const day of days) {
        accumulated.push(day);
        dirty = true;
      }
    }
  }

  const all = sortedUnique(Int32Array.from(accumulated));

  return all.subarray(
    lowerBound(all, windowFirst),
    lowerBound(all, windowLast + 1),
  );
}
