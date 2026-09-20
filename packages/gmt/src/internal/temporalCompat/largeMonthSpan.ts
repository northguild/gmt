import { Temporal } from "@js-temporal/polyfill";
import { calendarDateFromFields } from "./calendarDateFromFields";
import { calendarFieldsOf } from "./calendarFields";
import type { YearMonth } from "./nonIsoArithmetic";

/*
 * D9: bounded month arithmetic over long spans in non-ISO calendars.
 *
 * WHY THIS FILE EXISTS. Polyfill 0.5.1 adds non-ISO months one month at a time
 * (`addMonthsCalendar`) and counts them the same way (`untilCalendar` with `largestUnit: "months"`),
 * caching every intermediate date. An in-range amount of a few million months is a fatal V8 heap
 * OOM, which no `try/catch` can turn into a sentinel. Its year steps (`add({ years })`,
 * `until({ largestUnit: "years" })`) and its reads are O(1). Measured in a 256 MB child process:
 * adding 100,000 years takes about 1.5 ms, while months cost 5–12 µs each and 3,000,000 of them
 * abort the process.
 *
 * WHAT IT DOES. It answers the two month questions of the arithmetic model (`addMonths`,
 * `monthsBetween` between month starts) by jumping whole years and leaving a remainder of a few
 * years' months to the caller's ordinary month-by-month answer. The months a year jump consumes
 * come only from Temporal's own reads:
 * - a calendar with no leap month code in the Intl era/monthCode proposal §4.1.4 Table 3 has the
 *   same months in every year, so the count is `years × monthsInYear`, read once;
 * - a calendar with leap month codes (`hebrew` among GMT's calendars) counts months from the ISO
 *   day span between the two year starts, divided by a mean month length that this file measures
 *   from Temporal's reads (an exact 64-year sum, then doubled spans, each counted by the previous
 *   mean). A count is accepted only when the span is within a third of a month of that count of mean
 *   months, which lunar month starts always are, and otherwise throws RangeError (a sentinel at
 *   the public seam). GMT states no calendar rule, month table or cycle length.
 *
 * DORMANT. Only amounts of at least `LARGE_MONTH_SPAN` months take this path, and it computes
 * the spec's answer, so removing it on a fixed runtime changes no output.
 *
 * Remove when a js-temporal release adds and differences non-ISO months in bounded work
 * (`pnpm compat`, repro D9). See README.md.
 */

/** Month amounts from here on take the year jumps; below it the polyfill costs about 10 ms. */
const LARGE_MONTH_SPAN = 1_200;

/** Intl era/monthCode proposal §4.1.4 Table 3: the calendars with leap month codes (`MxxL`). */
const LEAP_MONTH_CALENDARS: ReadonlySet<string> = new Set([
  "chinese",
  "dangi",
  "hebrew",
]);
const ISO_CALENDAR = "iso8601";
/** Years whose month counts are read one by one before any mean is trusted. */
const SUMMED_YEARS = 64;
/** Year jumps stop this many years short of the estimate, so the remainder keeps its sign. */
const MARGIN_YEARS = 2;
/** The largest distance, in mean months, a span may be from a whole month count. */
const RESIDUAL_LIMIT = 1 / 3;

interface MonthProfile {
  /** Months in every year, for calendars without leap months. */
  fixedMonthsPerYear?: number;
  /** Measured mean month length in days, for calendars with leap months. */
  meanMonthDays?: number;
  meanMonthsPerYear: number;
}

const profiles = new Map<string, MonthProfile>();

function yearStart(
  calendarId: string,
  year: number,
): Temporal.PlainDate | undefined {
  try {
    return calendarDateFromFields(
      calendarId,
      { year, month: 1, day: 1 },
      "reject",
    );
  } catch (error) {
    if (error instanceof RangeError) {
      return undefined;
    }
    throw error;
  }
}

function daysBetween(one: Temporal.PlainDate, two: Temporal.PlainDate): number {
  return one
    .withCalendar(ISO_CALENDAR)
    .until(two.withCalendar(ISO_CALENDAR), { largestUnit: "days" }).days;
}

/** The ordinal of `year`'s last month, read from the day before the next year starts. */
function monthsInYear(calendarId: string, year: number): number {
  const next = yearStart(calendarId, year + 1);
  const read =
    next === undefined
      ? undefined
      : calendarFieldsOf(next.subtract({ days: 1 }), calendarId);
  if (read?.year !== year) {
    throw new RangeError(`${calendarId} year ${year} is not fully in range`);
  }
  return read.month;
}

/** Months in whole years `[from, from + years)`, read one year at a time. */
function summedMonths(calendarId: string, from: number, years: number): number {
  let months = 0;
  for (let year = from; year < from + years; year++) {
    months += monthsInYear(calendarId, year);
  }
  return months;
}

/** `days / meanMonthDays` when it is within `RESIDUAL_LIMIT` of a whole number of months. */
function wholeMonths(days: number, meanMonthDays: number): number {
  const months = Math.round(days / meanMonthDays);
  if (
    Math.abs(days - months * meanMonthDays) >
    RESIDUAL_LIMIT * meanMonthDays
  ) {
    throw new RangeError("Month count is not determined by the day span");
  }
  return months;
}

function measureProfile(calendarId: string): MonthProfile {
  const base = calendarFieldsOf(
    Temporal.PlainDate.from("2000-01-01"),
    calendarId,
  ).year;
  if (!LEAP_MONTH_CALENDARS.has(calendarId)) {
    const months = monthsInYear(calendarId, base);
    return { fixedMonthsPerYear: months, meanMonthsPerYear: months };
  }
  const start = yearStart(calendarId, base);
  const summedEnd = yearStart(calendarId, base + SUMMED_YEARS);
  if (start === undefined || summedEnd === undefined) {
    throw new RangeError(`${calendarId} has no modern years to measure`);
  }
  let months = summedMonths(calendarId, base, SUMMED_YEARS);
  let meanMonthDays = daysBetween(start, summedEnd) / months;
  let years = SUMMED_YEARS;
  for (;;) {
    const end = yearStart(calendarId, base + 2 * years);
    if (end === undefined) {
      break;
    }
    years *= 2;
    const days = daysBetween(start, end);
    months = wholeMonths(days, meanMonthDays);
    meanMonthDays = days / months;
  }
  return { meanMonthDays, meanMonthsPerYear: months / years };
}

function profileOf(calendarId: string): MonthProfile {
  let profile = profiles.get(calendarId);
  if (profile === undefined) {
    profile = measureProfile(calendarId);
    profiles.set(calendarId, profile);
  }
  return profile;
}

/**
 * Months from the start of `fromYear` to the start of `toYear` (negative when `toYear` is
 * earlier); `null` when a leap-month calendar cannot place one of those year starts, which lies
 * outside the range.
 */
function monthsBetweenYearStarts(
  calendarId: string,
  fromYear: number,
  toYear: number,
): number | null {
  const profile = profileOf(calendarId);
  if (profile.fixedMonthsPerYear !== undefined) {
    return (toYear - fromYear) * profile.fixedMonthsPerYear;
  }
  const sign = Math.sign(toYear - fromYear);
  const low = Math.min(fromYear, toYear);
  const years = Math.abs(toYear - fromYear);
  if (years <= SUMMED_YEARS) {
    return sign * summedMonths(calendarId, low, years);
  }
  const start = yearStart(calendarId, fromYear);
  const end = yearStart(calendarId, toYear);
  if (start === undefined || end === undefined) {
    return null;
  }
  // `measureProfile` always sets `meanMonthDays` for every `LEAP_MONTH_CALENDARS` member —
  // the only calendars that reach this line, since the `fixedMonthsPerYear` branch above
  // already returned. Dead by construction today, but a `?? 0` here would silently turn a
  // future violation of that invariant into `days / 0` (`Infinity`) instead of a clear
  // error, so it is asserted instead.
  if (profile.meanMonthDays === undefined) {
    throw new RangeError(`${calendarId} has no measured mean month length`);
  }
  return wholeMonths(daysBetween(start, end), profile.meanMonthDays);
}

/** True when an amount of months is large enough for the year jumps. */
export function isLargeMonthSpan(months: number): boolean {
  return Math.abs(months) >= LARGE_MONTH_SPAN;
}

/** True when two calendar years are far enough apart for the year jumps. */
export function isLargeYearSpan(fromYear: number, toYear: number): boolean {
  return Math.abs(toYear - fromYear) * 12 >= LARGE_MONTH_SPAN;
}

type AddMonths = (start: YearMonth, months: number) => YearMonth | null;
type MonthsBetween = (from: YearMonth, to: YearMonth) => number;

/**
 * `BalanceNonISODate(start.year, start.month + months, 1)` for a large `months`: step to the next
 * (or previous) year start, jump whole years, and let `addSmall` finish the few years left.
 * `null` when the result lies outside the range.
 */
export function addManyMonths(
  calendarId: string,
  start: YearMonth,
  months: number,
  addSmall: AddMonths,
  betweenSmall: MonthsBetween,
): YearMonth | null {
  const sign = Math.sign(months);
  const first = { year: start.year + sign, month: 1 };
  if (yearStart(calendarId, first.year) === undefined) {
    return null;
  }
  const remaining = months - betweenSmall(start, first);
  const years =
    sign *
    Math.max(
      0,
      Math.floor(
        Math.abs(remaining) / profileOf(calendarId).meanMonthsPerYear,
      ) - MARGIN_YEARS,
    );
  const consumed = monthsBetweenYearStarts(
    calendarId,
    first.year,
    first.year + years,
  );
  return consumed === null
    ? null
    : addSmall({ year: first.year + years, month: 1 }, remaining - consumed);
}

/**
 * The signed month count from `from` to `to` (both month starts in range) when they are years
 * apart: the months to the first whole year, the whole years, and the months after the last.
 */
export function countManyMonths(
  calendarId: string,
  from: YearMonth,
  to: YearMonth,
  betweenSmall: MonthsBetween,
): number {
  const forward = to.year > from.year;
  const first = { year: from.year + (forward ? 1 : 0), month: 1 };
  const last = { year: to.year + (forward ? 0 : 1), month: 1 };
  const whole = monthsBetweenYearStarts(calendarId, first.year, last.year);
  if (whole === null) {
    throw new RangeError(
      `Cannot count ${calendarId} months from ${from.year} to ${to.year}`,
    );
  }
  return betweenSmall(from, first) + whole + betweenSmall(last, to);
}
