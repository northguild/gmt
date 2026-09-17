import type { Temporal } from "@js-temporal/polyfill";
import { calendarDateFromFields } from "./calendarDateFromFields";
import { calendarFieldsOf } from "./calendarFields";
import {
  floorDateForFields,
  floorDateForFieldsBetween,
  isLastRepresentableDate,
} from "./fieldSearch";
import {
  addManyMonths,
  countManyMonths,
  isLargeMonthSpan,
  isLargeYearSpan,
} from "./largeMonthSpan";
import type { ArithmeticModel, YearMonth } from "./nonIsoArithmetic";

/*
 * The integer month questions `nonIsoArithmetic.ts` asks, answered without any calendar rule:
 * - reads through `calendarFieldsOf` (correct for every in-range date),
 * - fields → ISO through `calendarDateFromFields` (the polyfill, or the field search near a limit),
 * - polyfill month arithmetic between **day-1** dates, which never constrains a day and so is
 *   correct in 0.5.1 wherever it does not throw (spec §3.5).
 *
 * The polyfill throws within about a year of a range limit (D1). There, months are stepped one at
 * a time from the field search, and the polyfill only counts or jumps between month starts away
 * from the limit.
 */

const ISO_CALENDAR = "iso8601";
const LAST = Number.MAX_SAFE_INTEGER;
/** Days searched past a month's first day for its last day: more than any calendar month has. */
const MONTH_SEARCH_DAYS = 64;
/**
 * Months stepped one at a time next to a limit. The polyfill's D1 windows reach at most 357 days
 * from a limit (persian at the minimum, CORE-6 spec §1.3), which 14 months always clear.
 */
const EDGE_WALK_MONTHS = 14;
const JUMP_BACKOFF_MONTHS = [
  EDGE_WALK_MONTHS,
  2 * EDGE_WALK_MONTHS,
  3 * EDGE_WALK_MONTHS,
] as const;
const CACHE_LIMIT = 1024;
const MONTH_CODE = /^M(\d{2})(L?)$/;

interface LastMonth {
  month: number;
  /** False when the year runs past the last representable date, so later months are unknown. */
  complete: boolean;
}

const models = new Map<string, ArithmeticModel>();
const lastMonths = new Map<string, LastMonth | null>();

function compareYearMonths(a: YearMonth, b: YearMonth): number {
  return a.year - b.year || a.month - b.month;
}

function unlessRangeError<T>(run: () => T): T | undefined {
  try {
    return run();
  } catch (error) {
    if (error instanceof RangeError) {
      return undefined;
    }
    throw error;
  }
}

function requireMonth(month: YearMonth | null): YearMonth {
  if (month === null) {
    throw new RangeError("Month is outside the representable range");
  }
  return month;
}

/** Day 1 of `month`, calendared; undefined when it does not exist or lies outside the range. */
function monthStart(
  calendarId: string,
  month: YearMonth,
): Temporal.PlainDate | undefined {
  return unlessRangeError(() =>
    calendarDateFromFields(
      calendarId,
      { year: month.year, month: month.month, day: 1 },
      "reject",
    ),
  );
}

/** The last ordinal month of `year`, or null when no day of that year is representable. */
function lastMonthOf(calendarId: string, year: number): LastMonth | null {
  const key = `${calendarId}/${year}`;
  const cached = lastMonths.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const floor = floorDateForFields(calendarId, {
    year,
    month: LAST,
    day: LAST,
  });
  const read = floor === null ? null : calendarFieldsOf(floor, calendarId);
  const result =
    floor !== null && read?.year === year
      ? { month: read.month, complete: !isLastRepresentableDate(floor) }
      : null;
  if (lastMonths.size >= CACHE_LIMIT) {
    lastMonths.clear();
  }
  lastMonths.set(key, result);
  return result;
}

function stepMonth(
  calendarId: string,
  month: YearMonth,
  sign: number,
): YearMonth | null {
  if (sign < 0) {
    if (month.month > 1) {
      return { year: month.year, month: month.month - 1 };
    }
    const previous = lastMonthOf(calendarId, month.year - 1);
    return previous === null
      ? null
      : { year: month.year - 1, month: previous.month };
  }
  const last = lastMonthOf(calendarId, month.year);
  if (last === null) {
    return null;
  }
  if (month.month < last.month) {
    return { year: month.year, month: month.month + 1 };
  }
  return last.complete ? { year: month.year + 1, month: 1 } : null;
}

function walkMonths(
  calendarId: string,
  start: YearMonth,
  months: number,
): YearMonth | null {
  const sign = Math.sign(months);
  let current: YearMonth | null = start;
  for (let step = 0; current !== null && step < Math.abs(months); step++) {
    current = stepMonth(calendarId, current, sign);
  }
  return current;
}

function polyfillAddMonths(
  calendarId: string,
  start: YearMonth,
  months: number,
): YearMonth | undefined {
  const origin = monthStart(calendarId, start);
  if (origin === undefined) {
    return undefined;
  }
  const moved = unlessRangeError(() =>
    calendarFieldsOf(origin.add({ months }), calendarId),
  );
  return moved?.day === 1
    ? { year: moved.year, month: moved.month }
    : undefined;
}

function addMonths(
  calendarId: string,
  start: YearMonth,
  months: number,
): YearMonth | null {
  if (months === 0) {
    return start;
  }
  if (isLargeMonthSpan(months)) {
    // D9: jump whole years instead of the polyfill's month-by-month loop.
    return addManyMonths(
      calendarId,
      start,
      months,
      (from, count) => addMonths(calendarId, from, count),
      (from, to) => monthsBetween(calendarId, from, to),
    );
  }
  const jumped = polyfillAddMonths(calendarId, start, months);
  if (jumped !== undefined) {
    return jumped;
  }
  return addMonthsNearLimit(calendarId, start, months);
}

/**
 * Near a limit: leave a month that begins before the range, jump to a month start short of the
 * limit, and step the rest.
 */
function addMonthsNearLimit(
  calendarId: string,
  start: YearMonth,
  months: number,
): YearMonth | null {
  const sign = Math.sign(months);
  let origin: YearMonth | null = start;
  let remaining = months;
  if (monthStart(calendarId, origin) === undefined) {
    origin = stepMonth(calendarId, origin, sign);
    remaining -= sign;
    if (origin === null || remaining === 0) {
      return origin;
    }
  }
  for (const backoff of JUMP_BACKOFF_MONTHS) {
    if (Math.abs(remaining) <= backoff) {
      return walkMonths(calendarId, origin, remaining);
    }
    const anchor = polyfillAddMonths(
      calendarId,
      origin,
      remaining - sign * backoff,
    );
    if (anchor !== undefined) {
      return walkMonths(calendarId, anchor, sign * backoff);
    }
  }
  throw new RangeError(
    `Cannot add ${months} months to ${calendarId} ${start.year}-${start.month}`,
  );
}

function polyfillMonthsBetween(
  calendarId: string,
  from: YearMonth,
  to: YearMonth,
): number | undefined {
  const start = monthStart(calendarId, from);
  const end = monthStart(calendarId, to);
  if (start === undefined || end === undefined) {
    return undefined;
  }
  return unlessRangeError(
    () => start.until(end, { largestUnit: "months" }).months,
  );
}

function monthsBetween(
  calendarId: string,
  from: YearMonth,
  to: YearMonth,
): number {
  const sign = Math.sign(compareYearMonths(to, from));
  if (sign === 0) {
    return 0;
  }
  if (isLargeYearSpan(from.year, to.year)) {
    // D9: count whole years instead of the polyfill's month-by-month loop.
    return countManyMonths(calendarId, from, to, (one, two) =>
      monthsBetween(calendarId, one, two),
    );
  }
  const direct = polyfillMonthsBetween(calendarId, from, to);
  if (direct !== undefined) {
    return direct;
  }
  return monthsBetweenNearLimit(calendarId, from, to, sign);
}

/**
 * Near a limit: count the months at each end one at a time, and let the polyfill count between
 * the month starts left in the middle.
 */
function monthsBetweenNearLimit(
  calendarId: string,
  from: YearMonth,
  to: YearMonth,
  sign: number,
): number {
  let low = from;
  let high = to;
  let count = 0;
  for (
    let step = 0;
    step < EDGE_WALK_MONTHS && compareYearMonths(low, high) !== 0;
    step++
  ) {
    low = requireMonth(stepMonth(calendarId, low, sign));
    count += sign;
  }
  for (
    let step = 0;
    step < EDGE_WALK_MONTHS && compareYearMonths(low, high) !== 0;
    step++
  ) {
    high = requireMonth(stepMonth(calendarId, high, -sign));
    count += sign;
  }
  if (compareYearMonths(low, high) === 0) {
    return count;
  }
  const middle = polyfillMonthsBetween(calendarId, low, high);
  if (middle === undefined) {
    throw new RangeError(
      `Cannot count ${calendarId} months from ${from.year}-${from.month} to ${to.year}-${to.month}`,
    );
  }
  return count + middle;
}

/**
 * The latest in-range date at or before the last day of `month`: searched in a window after the
 * month's first day when that day is readable, with a read-back that the next day starts a new
 * month (otherwise, and when day 1 is not readable, over the whole range).
 */
function lastDayFloor(
  calendarId: string,
  month: YearMonth,
): Temporal.PlainDate | null {
  const target = { year: month.year, month: month.month, day: LAST };
  const start = monthStart(calendarId, month);
  const windowed =
    start === undefined
      ? null
      : floorDateForFieldsBetween(calendarId, target, start, MONTH_SEARCH_DAYS);
  if (
    windowed !== null &&
    (isLastRepresentableDate(windowed) ||
      calendarFieldsOf(windowed.add({ days: 1 }), calendarId).month !==
        month.month)
  ) {
    return windowed;
  }
  return floorDateForFields(calendarId, target);
}

function daysInMonth(calendarId: string, month: YearMonth): number | null {
  const floor = lastDayFloor(calendarId, month);
  if (floor === null || isLastRepresentableDate(floor)) {
    return null;
  }
  const read = calendarFieldsOf(floor, calendarId);
  return read.year === month.year && read.month === month.month
    ? read.day
    : null;
}

/** The month code of `month`, or undefined when no day of it can be read. */
function monthCodeAt(calendarId: string, month: YearMonth): string | undefined {
  const start = monthStart(calendarId, month);
  if (start !== undefined) {
    return calendarFieldsOf(start, calendarId).monthCode;
  }
  const floor = floorDateForFields(calendarId, { ...month, day: LAST });
  const read = floor === null ? null : calendarFieldsOf(floor, calendarId);
  return read?.year === month.year && read.month === month.month
    ? read.monthCode
    : undefined;
}

/**
 * The ordinal of `monthCode` in `year`. By the month code grammar a code's ordinal is its number,
 * or one more when a leap month precedes it in that year, and a leap code `MxxL` directly follows
 * `Mxx` (the proposal allows at most one leap month per year). Both candidates are read back.
 */
function monthOrdinal(
  calendarId: string,
  year: number,
  monthCode: string,
): number | "missing" | null {
  const match = MONTH_CODE.exec(monthCode);
  if (!match) {
    throw new RangeError(`Invalid month code: ${monthCode}`);
  }
  const number = Number(match[1]);
  const candidates = match[2] === "L" ? [number + 1] : [number, number + 1];
  let unreadable = false;
  for (const ordinal of candidates) {
    const code = monthCodeAt(calendarId, { year, month: ordinal });
    if (code === monthCode) {
      return ordinal;
    }
    unreadable ||= code === undefined;
  }
  return unreadable ? null : "missing";
}

/** The read-backed arithmetic model for a Temporal calendar id (one per calendar, memoized). */
export function readArithmeticModel(calendarId: string): ArithmeticModel {
  let model = models.get(calendarId);
  if (model === undefined) {
    model = {
      calendarId,
      fields: (date) => calendarFieldsOf(date, calendarId),
      monthOrdinal: (year, monthCode) =>
        monthOrdinal(calendarId, year, monthCode),
      addMonths: (start, months) => addMonths(calendarId, start, months),
      monthsBetween: (from, to) => monthsBetween(calendarId, from, to),
      daysInMonth: (month) => daysInMonth(calendarId, month),
      toDate: (year, month, day) =>
        calendarDateFromFields(
          calendarId,
          { year, month, day },
          "reject",
        ).withCalendar(ISO_CALENDAR),
    };
    models.set(calendarId, model);
  }
  return model;
}
