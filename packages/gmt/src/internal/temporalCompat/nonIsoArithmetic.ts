import { Temporal } from "@js-temporal/polyfill";

/*
 * The Intl era/monthCode proposal's non-ISO date arithmetic, written literally over an integer
 * calendar model (`ArithmeticModel`) instead of over the polyfill's own `calendarToIsoDate`:
 *
 * - `NonISODateAdd` (with `ConstrainMonthCode` and `BalanceNonISODate`),
 * - `NonISODateSurpasses` (with `CompareSurpasses`), which compares the **un-constrained** day,
 * - `NonISODateUntil`, whose naive "add one unit while it does not surpass" loops start here from
 *   an estimate and adjust by at most a few units.
 *
 * WHY THIS FILE EXISTS (CORE-6 calendar-correctness spec §3.5). Polyfill 0.5.1:
 * - D6: `until` re-constrains the day while counting months, so Aug 31 → Sep 30 is `P1M` where the
 *   spec says `P30D` (every non-ISO calendar; fixed on js-temporal main by 10aeb98, unreleased);
 * - D7: `until` with `largestUnit: "years"` throws "mixed-sign" when a Hebrew `M05L` start overshoots
 *   (proposal-temporal 0e32ee0, not ported);
 * - D1: add and until probe outside the legacy `Date` range within about a year of both limits and
 *   throw (proposal-temporal a41eb67 + af0cb4b, not ported);
 * - D2/D3/D4/D5: the corrected calendars' own arithmetic is wrong wherever their reads are.
 *
 * The models (`readArithmeticModel.ts`, and the owned Hebrew and Indian arithmetic) only answer
 * integer questions about months; every algorithm step below is the spec's. A fixed polyfill runs
 * the same algorithm, so removing this file changes no output.
 */

/** A date's fields in one calendar. `month` is ordinal. */
export interface CalendarDateParts {
  year: number;
  month: number;
  monthCode: string;
  day: number;
}

export interface YearMonth {
  year: number;
  month: number;
}

export interface DateDurationFields {
  years: number;
  months: number;
  weeks: number;
  days: number;
}

export type ArithmeticOverflow = "constrain" | "reject";

/**
 * Integer questions about one calendar's months. `null` answers mean "this month lies outside the
 * TC39 PlainDate range, so nothing about it can be read": the algorithms only ask about such a month
 * when the date they would build is out of range too, which the spec turns into a RangeError or, in
 * `NonISODateSurpasses`, into "surpasses".
 */
export interface ArithmeticModel {
  /** Temporal calendar id. */
  calendarId: string;
  fields(date: Temporal.PlainDate): CalendarDateParts;
  /** Ordinal of `monthCode` in `year`; `"missing"` when that year has no such month (a leap month). */
  monthOrdinal(year: number, monthCode: string): number | "missing" | null;
  /** `BalanceNonISODate(year, month + months, 1)`: `month` may exceed the year's month count. */
  addMonths(start: YearMonth, months: number): YearMonth | null;
  /** Signed month count between two month starts (an estimate is enough: callers adjust). */
  monthsBetween(from: YearMonth, to: YearMonth): number;
  daysInMonth(month: YearMonth): number | null;
  /** The ISO-calendared date of these fields; throws RangeError when they are invalid or out of range. */
  toDate(year: number, month: number, day: number): Temporal.PlainDate;
}

const ISO_CALENDAR = "iso8601";
/** The estimates below are off by at most one unit; a few extra steps cost nothing. */
const MAX_ADJUSTMENTS = 4;
/** A leap month recurs within one Metonic cycle, so a year lacking it is found within 19 years. */
const LEAP_MONTH_SEARCH_YEARS = 19;
const MONTH_CODE = /^M(\d{2})(L?)$/;

const constrainedMonthCodes = new Map<string, string>();

/** `ParseMonthCode` ordering: `M05 < M05L < M06` (grammar, not calendar data). */
export function compareMonthCodes(a: string, b: string): number {
  const matchA = MONTH_CODE.exec(a);
  const matchB = MONTH_CODE.exec(b);
  if (!matchA || !matchB) {
    throw new RangeError(`Invalid month code: ${matchA ? b : a}`);
  }
  return (
    Number(matchA[1]) - Number(matchB[1]) ||
    Number(matchA[2] === "L") - Number(matchB[2] === "L")
  );
}

/**
 * The month code the runtime constrains a leap month code to in a year without it (Hebrew
 * `M05L` → `M06`), read once per calendar from the polyfill at a modern year, where its constrain
 * behaviour is correct. GMT never states the mapping itself.
 */
function constrainedMonthCode(calendarId: string, monthCode: string): string {
  const key = `${calendarId}/${monthCode}`;
  const cached = constrainedMonthCodes.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const modernYear = Temporal.PlainDate.from("2000-01-01").withCalendar(
    calendarId,
  ).year;
  for (let offset = 0; offset < LEAP_MONTH_SEARCH_YEARS; offset++) {
    const fields = {
      calendar: calendarId,
      year: modernYear + offset,
      monthCode,
      day: 1,
    };
    try {
      Temporal.PlainDate.from(fields, { overflow: "reject" });
    } catch (error) {
      if (!(error instanceof RangeError)) {
        throw error;
      }
      const code = Temporal.PlainDate.from(fields, {
        overflow: "constrain",
      }).monthCode;
      constrainedMonthCodes.set(key, code);
      return code;
    }
  }
  throw new RangeError(`${calendarId} has ${monthCode} in every year`);
}

/** `ConstrainMonthCode`: the ordinal month for `monthCode` in `year`, or `null` outside the range. */
function constrainMonthCode(
  model: ArithmeticModel,
  year: number,
  monthCode: string,
  overflow: ArithmeticOverflow,
): number | null {
  const ordinal = model.monthOrdinal(year, monthCode);
  if (ordinal !== "missing") {
    return ordinal;
  }
  if (overflow === "reject") {
    throw new RangeError(
      `${model.calendarId} year ${year} has no month ${monthCode}`,
    );
  }
  const constrained = model.monthOrdinal(
    year,
    constrainedMonthCode(model.calendarId, monthCode),
  );
  if (constrained === "missing") {
    throw new RangeError(
      `${model.calendarId} year ${year} has no month for ${monthCode}`,
    );
  }
  return constrained;
}

function compareByMonthCode(
  year: number,
  monthCode: string,
  day: number,
  target: CalendarDateParts,
): number {
  return (
    year - target.year ||
    compareMonthCodes(monthCode, target.monthCode) ||
    day - target.day
  );
}

function compareByOrdinal(
  year: number,
  month: number,
  day: number,
  target: CalendarDateParts,
): number {
  return year - target.year || month - target.month || day - target.day;
}

function requireInRange<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new RangeError(`${what} is outside the representable range`);
  }
  return value;
}

/** The day of `month` regulated per `overflow`, as an ISO-calendared date (RangeError out of range). */
function regulatedDate(
  model: ArithmeticModel,
  month: YearMonth,
  day: number,
  overflow: ArithmeticOverflow,
): Temporal.PlainDate {
  // An unknown length means the month runs past the range limit; `day` is then either an in-range
  // day of it or past the limit, where `toDate` throws as the spec's ISODateWithinLimits does.
  const length = model.daysInMonth(month);
  if (length !== null && day > length) {
    if (overflow === "reject") {
      throw new RangeError(
        `Day ${day} is past the end of ${model.calendarId} ${month.year}-${month.month}`,
      );
    }
    return model.toDate(month.year, month.month, length);
  }
  return model.toDate(month.year, month.month, day);
}

/** `NonISODateAdd` steps 1–9 for years and months only, as an ISO-calendared date. */
function addYearsAndMonths(
  model: ArithmeticModel,
  from: CalendarDateParts,
  years: number,
  months: number,
  overflow: ArithmeticOverflow,
): Temporal.PlainDate {
  const year = from.year + years;
  const startMonth = requireInRange(
    constrainMonthCode(model, year, from.monthCode, overflow),
    `${model.calendarId} ${year}-${from.monthCode}`,
  );
  const month = requireInRange(
    model.addMonths({ year, month: startMonth }, months),
    `${model.calendarId} month ${months} after ${year}-${startMonth}`,
  );
  return regulatedDate(model, month, from.day, overflow);
}

/**
 * `NonISODateAdd(calendar, date, duration, overflow)`. Weeks and days are ISO day arithmetic, as in
 * the spec's final `BalanceNonISODate` + `CalendarIntegersToISO`.
 *
 * @returns the result as an ISO-calendared PlainDate; throws RangeError out of range or on reject
 */
export function nonIsoDateAdd(
  model: ArithmeticModel,
  date: Temporal.PlainDate,
  duration: DateDurationFields,
  overflow: ArithmeticOverflow,
): Temporal.PlainDate {
  return addYearsAndMonths(
    model,
    model.fields(date),
    duration.years,
    duration.months,
    overflow,
  ).add({ days: 7 * duration.weeks + duration.days });
}

/**
 * `NonISODateSurpasses(calendar, sign, from, to, years, months, weeks, days)`. A month or date the
 * model cannot place lies beyond the range in the direction of `sign`, hence past `to`.
 */
function nonIsoDateSurpasses(
  model: ArithmeticModel,
  sign: number,
  from: CalendarDateParts,
  to: CalendarDateParts & { date: Temporal.PlainDate },
  duration: DateDurationFields,
): boolean {
  const year = from.year + duration.years;
  if (sign * compareByMonthCode(year, from.monthCode, from.day, to) > 0) {
    return true;
  }
  const startMonth = constrainMonthCode(
    model,
    year,
    from.monthCode,
    "constrain",
  );
  const month =
    startMonth === null
      ? null
      : model.addMonths({ year, month: startMonth }, duration.months);
  if (
    month === null ||
    sign * compareByOrdinal(month.year, month.month, from.day, to) > 0
  ) {
    return true;
  }
  if (duration.weeks === 0 && duration.days === 0) {
    return false;
  }
  try {
    const end = regulatedDate(model, month, from.day, "constrain").add({
      days: 7 * duration.weeks + duration.days,
    });
    return sign * Temporal.PlainDate.compare(end, to.date) > 0;
  } catch (error) {
    if (error instanceof RangeError) {
      return true;
    }
    throw error;
  }
}

/** The largest count (from `estimate`, toward `sign`) that does not surpass. */
function maximizeCount(
  estimate: number,
  sign: number,
  surpasses: (count: number) => boolean,
): number {
  let count = sign * estimate > 0 ? estimate : 0;
  for (let step = 0; count !== 0 && surpasses(count); step++) {
    if (step === MAX_ADJUSTMENTS) {
      throw new RangeError("Calendar difference estimate did not converge");
    }
    count -= sign;
  }
  for (let step = 0; !surpasses(count + sign); step++) {
    if (step === MAX_ADJUSTMENTS) {
      throw new RangeError("Calendar difference estimate did not converge");
    }
    count += sign;
  }
  return count;
}

function durationOf(years: number, months: number, days = 0) {
  return { years, months, weeks: 0, days };
}

/** `NonISODateSurpasses` from `one` toward `two`, with the two dates' fields read once. */
function surpassesBetween(
  model: ArithmeticModel,
  sign: number,
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
): (duration: DateDurationFields) => boolean {
  const from = model.fields(one);
  const to = { ...model.fields(two), date: two };
  return (duration) => nonIsoDateSurpasses(model, sign, from, to, duration);
}

/**
 * `NonISODateUntil(calendar, one, two, largestUnit)` for `largestUnit` year or month (days and
 * weeks are calendar-independent: callers use ISO `until`).
 */
export function nonIsoDateUntil(
  model: ArithmeticModel,
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  largestUnit: "year" | "month",
): DateDurationFields {
  const sign = -Temporal.PlainDate.compare(one, two);
  if (sign === 0) {
    return durationOf(0, 0);
  }
  const from = model.fields(one);
  const to = model.fields(two);
  const surpasses = surpassesBetween(model, sign, one, two);

  const years =
    largestUnit === "year"
      ? maximizeCount(to.year - from.year, sign, (count) =>
          surpasses(durationOf(count, 0)),
        )
      : 0;
  const year = from.year + years;
  const startMonth =
    years === 0
      ? from.month
      : requireInRange(
          constrainMonthCode(model, year, from.monthCode, "constrain"),
          `${model.calendarId} ${year}-${from.monthCode}`,
        );
  const months = maximizeCount(
    model.monthsBetween({ year, month: startMonth }, to),
    sign,
    (count) => surpasses(durationOf(years, count)),
  );
  const intermediate = addYearsAndMonths(
    model,
    from,
    years,
    months,
    "constrain",
  );
  const { days } = intermediate.until(two.withCalendar(ISO_CALENDAR), {
    largestUnit: "days",
  });
  return durationOf(years, months, days);
}

/**
 * True when `result` is exactly `NonISODateUntil(one, two, largestUnit)`: it does not surpass, its
 * signs agree, and adding one more of each unit it could hold does surpass (so no unit is short).
 * The per-call guard that keeps a correct polyfill answer.
 */
export function isNonIsoDateUntilResult(
  model: ArithmeticModel,
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  largestUnit: "year" | "month",
  result: DateDurationFields,
): boolean {
  const sign = -Temporal.PlainDate.compare(one, two);
  const { years, months, weeks, days } = result;
  if (sign === 0) {
    return years === 0 && months === 0 && weeks === 0 && days === 0;
  }
  if (
    weeks !== 0 ||
    sign * years < 0 ||
    sign * months < 0 ||
    sign * days < 0 ||
    (largestUnit === "month" && years !== 0)
  ) {
    return false;
  }
  const surpasses = surpassesBetween(model, sign, one, two);
  return (
    !surpasses(durationOf(years, months, days)) &&
    surpasses(durationOf(years, months, days + sign)) &&
    surpasses(durationOf(years, months + sign)) &&
    (largestUnit === "month" || surpasses(durationOf(years + sign, 0)))
  );
}
