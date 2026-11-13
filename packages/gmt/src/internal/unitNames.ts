import type { Temporal } from "./temporal";
import { plainDateOf } from "./inputChecks";
import { isObject } from "./isObject";
import type {
  DateCycleField,
  DateDurationUnit,
  DateTimeCycleField,
  DateTimeDurationUnit,
  DateTimeUnit,
  DateUnit,
  FiscalCalendar,
  FiscalExtraWeek,
  FiscalPattern,
  FiscalYearLabel,
  TimeCycleField,
  TimeDurationUnit,
  TimeUnit,
  ZoneBucketUnit,
} from "../types";

/**
 * The membership checks behind the public unit, cycle-field and fiscal validators, so a public
 * function never calls another. Each takes any value and is `false` for a value that is not one
 * of the listed names.
 */

// The names the checks below accept. `includes` compares with `===`, so a value that is not one of
// these strings (a symbol, an object, `undefined`) is `false`.
const DATE_UNITS: readonly string[] = ["year", "month", "week", "day"];
const TIME_UNITS: readonly string[] = [
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];
/** The plural date duration unit names, coarsest first. */
export const DATE_DURATION_UNITS: readonly DateDurationUnit[] = [
  "years",
  "months",
  "weeks",
  "days",
];
/** The plural time duration unit names, coarsest first. */
export const TIME_DURATION_UNITS: readonly TimeDurationUnit[] = [
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "microseconds",
  "nanoseconds",
];
const DATE_CYCLE_FIELDS: readonly string[] = ["year", "month", "day"];

/**
 * The check behind `isValidDateTimeDurationUnit`.
 *
 * @param unit the candidate
 * @returns whether it is a plural date or time duration unit name
 *
 * @example isDateTimeDurationUnitName("days") // true
 * @example isDateTimeDurationUnitName("day") // false
 */
export function isDateTimeDurationUnitName(
  unit: unknown,
): unit is DateTimeDurationUnit {
  return (
    (DATE_DURATION_UNITS as readonly unknown[]).includes(unit) ||
    (TIME_DURATION_UNITS as readonly unknown[]).includes(unit)
  );
}

/**
 * The check behind `isValidDateDurationUnit`.
 *
 * @param unit the candidate
 * @returns whether it is `"years"`, `"months"`, `"weeks"` or `"days"`
 *
 * @example isDateDurationUnitName("weeks") // true
 * @example isDateDurationUnitName("hours") // false
 */
export function isDateDurationUnitName(
  unit: unknown,
): unit is DateDurationUnit {
  return (DATE_DURATION_UNITS as readonly unknown[]).includes(unit);
}

/**
 * The check behind `isValidTimeDurationUnit`.
 *
 * @param unit the candidate
 * @returns whether it is a plural time duration unit name, `"hours"` to `"nanoseconds"`
 *
 * @example isTimeDurationUnitName("hours") // true
 * @example isTimeDurationUnitName("days") // false
 */
export function isTimeDurationUnitName(
  unit: unknown,
): unit is TimeDurationUnit {
  return (TIME_DURATION_UNITS as readonly unknown[]).includes(unit);
}

/**
 * The check behind `isValidDateTimeUnit`.
 *
 * @param unit the candidate
 * @returns whether it is a singular date or time unit name
 *
 * @example isDateTimeUnitName("day") // true
 * @example isDateTimeUnitName("days") // false
 */
export function isDateTimeUnitName(unit: unknown): unit is DateTimeUnit {
  return (
    DATE_UNITS.includes(unit as DateUnit) ||
    TIME_UNITS.includes(unit as TimeUnit)
  );
}

/**
 * The check behind `isValidDateUnit`.
 *
 * @param unit the candidate
 * @returns whether it is `"year"`, `"month"`, `"week"` or `"day"`
 *
 * @example isDateUnitName("week") // true
 * @example isDateUnitName("hour") // false
 */
export function isDateUnitName(unit: unknown): unit is DateUnit {
  return DATE_UNITS.includes(unit as DateUnit);
}

/**
 * The check behind `isValidTimeUnit`.
 *
 * @param unit the candidate
 * @returns whether it is a singular time unit name, `"hour"` to `"nanosecond"`
 *
 * @example isTimeUnitName("hour") // true
 * @example isTimeUnitName("day") // false
 */
export function isTimeUnitName(unit: unknown): unit is TimeUnit {
  return TIME_UNITS.includes(unit as TimeUnit);
}

/**
 * The check behind `isValidDateCycleField`.
 *
 * @param field the candidate
 * @returns whether it is `"year"`, `"month"` or `"day"`
 *
 * @example isDateCycleFieldName("month") // true
 * @example isDateCycleFieldName("week") // false
 */
export function isDateCycleFieldName(field: unknown): field is DateCycleField {
  return DATE_CYCLE_FIELDS.includes(field as DateCycleField);
}

/**
 * The check behind `isValidTimeCycleField`.
 *
 * @param field the candidate
 * @returns whether it is a singular time unit name, `"hour"` to `"nanosecond"`
 *
 * @example isTimeCycleFieldName("minute") // true
 * @example isTimeCycleFieldName("day") // false
 */
export function isTimeCycleFieldName(field: unknown): field is TimeCycleField {
  return TIME_UNITS.includes(field as TimeCycleField);
}

/**
 * The check behind `isValidDateTimeCycleField`.
 *
 * @param field the candidate
 * @returns whether it is a date or a time cycle field name
 *
 * @example isDateTimeCycleFieldName("hour") // true
 * @example isDateTimeCycleFieldName("week") // false
 */
export function isDateTimeCycleFieldName(
  field: unknown,
): field is DateTimeCycleField {
  return isDateCycleFieldName(field) || isTimeCycleFieldName(field);
}

/** The singular names a zone bucket takes. */
function isZoneBucketBase(unit: string): boolean {
  return (
    unit === "hour" || unit === "day" || unit === "week" || unit === "month"
  );
}

/**
 * The check behind `isValidZoneBucketUnit`: `"hour"`, `"day"`, `"week"` or `"month"`, or the
 * plural of one (a trailing `s`, as `resolveDateTimeUnit` reads it).
 *
 * @param unit the candidate
 * @returns whether it names a zone bucket
 *
 * @example isZoneBucketUnitName("weeks") // true
 * @example isZoneBucketUnitName("year") // false
 */
export function isZoneBucketUnitName(
  unit: unknown,
): unit is Temporal.SmallestUnit<ZoneBucketUnit> {
  if (typeof unit !== "string") {
    return false;
  }
  return (
    isZoneBucketBase(unit) ||
    (unit.endsWith("s") && isZoneBucketBase(unit.slice(0, -1)))
  );
}

/**
 * The check behind `isValidFiscalPattern`.
 *
 * @param pattern the candidate
 * @returns whether it is `"4-5-4"`, `"4-4-5"` or `"5-4-4"`
 *
 * @example isFiscalPatternName("4-5-4") // true
 * @example isFiscalPatternName("4-5-5") // false
 */
export function isFiscalPatternName(
  pattern: unknown,
): pattern is FiscalPattern {
  return pattern === "4-5-4" || pattern === "4-4-5" || pattern === "5-4-4";
}

/**
 * The check behind `isValidFiscalExtraWeek`.
 *
 * @param value the candidate
 * @returns whether it is `"firstPeriod"` or `"lastPeriod"`
 *
 * @example isFiscalExtraWeekName("lastPeriod") // true
 * @example isFiscalExtraWeekName("none") // false
 */
export function isFiscalExtraWeekName(
  value: unknown,
): value is FiscalExtraWeek {
  return value === "firstPeriod" || value === "lastPeriod";
}

/**
 * The check behind `isValidFiscalYearLabel`.
 *
 * @param value the candidate
 * @returns whether it is `"startYear"`, `"endYear"` or `"majorityYear"`
 *
 * @example isFiscalYearLabelName("endYear") // true
 * @example isFiscalYearLabelName("year") // false
 */
export function isFiscalYearLabelName(
  value: unknown,
): value is FiscalYearLabel {
  return (
    value === "startYear" || value === "endYear" || value === "majorityYear"
  );
}

/**
 * The check behind `isValidFiscalCalendar`: a plain object with a fiscal pattern, an ISO
 * `yearEndsOn` date, an extra-week rule and a year label. Never throws.
 *
 * @param calendar the candidate
 * @returns whether it is a `FiscalCalendar`
 *
 * @example isFiscalCalendarRecord({ pattern: "4-5-4", yearEndsOn: "2024-02-03", extraWeek: "lastPeriod", yearLabel: "endYear" }) // true
 * @example isFiscalCalendarRecord(null) // false
 */
export function isFiscalCalendarRecord(
  calendar: unknown,
): calendar is FiscalCalendar {
  try {
    if (!isObject(calendar) || Array.isArray(calendar)) {
      return false;
    }

    const { pattern, yearEndsOn, extraWeek, yearLabel } = calendar as Record<
      string,
      unknown
    >;

    return (
      isFiscalPatternName(pattern) &&
      typeof yearEndsOn === "string" &&
      plainDateOf(yearEndsOn) !== null &&
      isFiscalExtraWeekName(extraWeek) &&
      isFiscalYearLabelName(yearLabel)
    );
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return false;
  }
}
