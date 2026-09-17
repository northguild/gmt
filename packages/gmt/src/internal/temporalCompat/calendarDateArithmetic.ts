import type { Temporal } from "@js-temporal/polyfill";
import { calendarFieldsOf, hasReadCorrection } from "./calendarFields";
import { isDefectPresent } from "./capabilities";
import { hebrewArithmeticModel } from "./hebrewArithmetic";
import { indianArithmeticModel } from "./indianArithmetic";
import { isLargeMonthSpan, isLargeYearSpan } from "./largeMonthSpan";
import {
  type ArithmeticModel,
  type ArithmeticOverflow,
  type DateDurationFields,
  isNonIsoDateUntilResult,
  nonIsoDateAdd,
  nonIsoDateUntil,
} from "./nonIsoArithmetic";
import { readArithmeticModel } from "./readArithmeticModel";

export type CalendarDateUnit = "year" | "month" | "week" | "day";

const ISO_CALENDAR = "iso8601";
const DATE_UNITS: ReadonlySet<string> = new Set([
  "year",
  "month",
  "week",
  "day",
]);
/**
 * The owned Hebrew and Indian arithmetic answers whenever an operation's years come within this
 * many years of the corrected range, so that no step of it (a Surpasses candidate overshoots by at
 * most one unit) reaches the runtime's wrong reads or arithmetic.
 */
const CORRECTED_RANGE_MARGIN_YEARS = 2;

const ownedModels: Readonly<Partial<Record<string, ArithmeticModel>>> = {
  hebrew: hebrewArithmeticModel,
  indian: indianArithmeticModel,
};

function fieldsOf(duration: Temporal.Duration): DateDurationFields {
  return {
    years: duration.years,
    months: duration.months,
    weeks: duration.weeks,
    days: duration.days,
  };
}

/**
 * D2: while buddhist reads are corrected, buddhist arithmetic is ISO arithmetic. The Intl
 * era/monthCode proposal makes buddhist month numbers, month codes and days identical to ISO 8601
 * with year = ISO year + 543, so NonISODateAdd/Until give exactly the ISO results.
 */
function usesIsoArithmetic(calendarId: string): boolean {
  return (
    calendarId === "buddhist" &&
    hasReadCorrection(calendarId, Number.NEGATIVE_INFINITY)
  );
}

/** The owned model for `calendarId` when its read correction is active in this runtime. */
function activeOwnedModel(calendarId: string): ArithmeticModel | undefined {
  const model = ownedModels[calendarId];
  return model !== undefined &&
    hasReadCorrection(calendarId, Number.NEGATIVE_INFINITY)
    ? model
    : undefined;
}

function reachesCorrectedRange(calendarId: string, years: number[]): boolean {
  return hasReadCorrection(
    calendarId,
    Math.min(...years) - CORRECTED_RANGE_MARGIN_YEARS,
  );
}

function untilWorkaroundNeeded(calendarId: string): boolean {
  return (
    isDefectPresent("D1", calendarId) ||
    isDefectPresent("D6", calendarId) ||
    isDefectPresent("D7", calendarId)
  );
}

function verifiedPolyfillUntil(
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  largestUnit: "year" | "month",
): DateDurationFields {
  const calendarId = one.calendarId;
  if (
    largestUnit === "month" &&
    isLargeYearSpan(
      calendarFieldsOf(one, calendarId).year,
      calendarFieldsOf(two, calendarId).year,
    )
  ) {
    // D9: the polyfill counts months one at a time; the spec loops count whole years instead.
    return nonIsoDateUntil(
      readArithmeticModel(calendarId),
      one,
      two,
      largestUnit,
    );
  }
  let result: DateDurationFields;
  try {
    result = fieldsOf(one.until(two, { largestUnit }));
  } catch (error) {
    if (!(error instanceof RangeError) || !untilWorkaroundNeeded(calendarId)) {
      throw error;
    }
    return nonIsoDateUntil(
      readArithmeticModel(calendarId),
      one,
      two,
      largestUnit,
    );
  }
  if (
    !isDefectPresent("D6", calendarId) &&
    !isDefectPresent("D7", calendarId)
  ) {
    return result;
  }
  const model = readArithmeticModel(calendarId);
  return isNonIsoDateUntilResult(model, one, two, largestUnit, result)
    ? result
    : nonIsoDateUntil(model, one, two, largestUnit);
}

/**
 * `one.until(two, { largestUnit })`'s date fields, made correct where `@js-temporal/polyfill` is not
 * (TC39 `CalendarDateUntil`, Intl era/monthCode proposal `NonISODateUntil`). Both dates must carry
 * the same calendar.
 *
 * - `iso8601` is the polyfill's own `until`, untouched.
 * - `"day"` / `"week"` are ISO `until`: days do not depend on the calendar.
 * - D6/D7: the polyfill answers first; while its probe fails, the answer is kept only when it is
 *   exactly the spec's (`isNonIsoDateUntilResult`), otherwise the spec loops recompute it.
 * - D1: a polyfill RangeError near a range limit is answered by the spec loops.
 * - D2/D3/D4/D5: in a corrected range the spec loops run over ISO (buddhist) or the owned Hebrew
 *   and Indian arithmetic.
 * - D9: months counted across `LARGE_MONTH_SPAN` months or more run the spec loops, whose month
 *   counts are bounded.
 */
export function calendarDateUntil(
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  largestUnit: CalendarDateUnit,
): DateDurationFields {
  const calendarId = one.calendarId;
  if (calendarId === ISO_CALENDAR) {
    return fieldsOf(one.until(two, { largestUnit }));
  }
  if (!DATE_UNITS.has(largestUnit)) {
    throw new RangeError(`${String(largestUnit)} is not a date unit`);
  }
  if (
    largestUnit === "week" ||
    largestUnit === "day" ||
    usesIsoArithmetic(calendarId)
  ) {
    return fieldsOf(
      one
        .withCalendar(ISO_CALENDAR)
        .until(two.withCalendar(ISO_CALENDAR), { largestUnit }),
    );
  }
  const owned = activeOwnedModel(calendarId);
  if (
    owned !== undefined &&
    reachesCorrectedRange(calendarId, [
      owned.fields(one).year,
      owned.fields(two).year,
    ])
  ) {
    return nonIsoDateUntil(owned, one, two, largestUnit);
  }
  return verifiedPolyfillUntil(one, two, largestUnit);
}

/**
 * The owned (Hebrew, Indian) model's sum, when `date`'s calendar has an active owned model and
 * either end reaches the corrected range; otherwise undefined, and the polyfill answers.
 */
function ownedDateAdd(
  date: Temporal.PlainDate,
  fields: DateDurationFields,
  overflow: ArithmeticOverflow,
): Temporal.PlainDate | undefined {
  const calendarId = date.calendarId;
  const owned = activeOwnedModel(calendarId);
  if (owned === undefined) {
    return undefined;
  }
  // Owned arithmetic is the spec's for every year, so its RangeErrors stand; its result is kept
  // when either end reaches the corrected range, and the polyfill answers elsewhere.
  const result = nonIsoDateAdd(owned, date, fields, overflow);
  return reachesCorrectedRange(calendarId, [
    owned.fields(date).year,
    owned.fields(result).year,
  ])
    ? result.withCalendar(calendarId)
    : undefined;
}

/**
 * `date.add(duration, { overflow })`, made correct where `@js-temporal/polyfill` is not (TC39
 * `CalendarDateAdd`, Intl era/monthCode proposal `NonISODateAdd`).
 *
 * - `iso8601` is the polyfill's own `add`, untouched.
 * - Weeks and days alone are ISO day arithmetic.
 * - D1: a polyfill RangeError near a range limit is answered by the spec algorithm.
 * - D2/D3/D4/D5: in a corrected range the spec algorithm runs over ISO (buddhist) or the owned
 *   Hebrew and Indian arithmetic.
 * - D9: `LARGE_MONTH_SPAN` months or more run the spec algorithm, whose month jumps are bounded.
 *
 * @returns a PlainDate in `date`'s calendar; throws RangeError out of range or on `reject`
 */
export function calendarDateAdd(
  date: Temporal.PlainDate,
  duration: Partial<DateDurationFields>,
  overflow: ArithmeticOverflow,
): Temporal.PlainDate {
  const calendarId = date.calendarId;
  if (calendarId === ISO_CALENDAR) {
    return date.add(duration, { overflow });
  }
  const fields: DateDurationFields = {
    years: duration.years ?? 0,
    months: duration.months ?? 0,
    weeks: duration.weeks ?? 0,
    days: duration.days ?? 0,
  };
  if (
    (fields.years === 0 && fields.months === 0) ||
    usesIsoArithmetic(calendarId)
  ) {
    return date
      .withCalendar(ISO_CALENDAR)
      .add(fields, { overflow })
      .withCalendar(calendarId);
  }
  const ownedResult = ownedDateAdd(date, fields, overflow);
  if (ownedResult !== undefined) {
    return ownedResult;
  }
  if (isLargeMonthSpan(fields.months)) {
    // D9: the polyfill adds months one at a time; the spec algorithm jumps whole years instead.
    return nonIsoDateAdd(
      readArithmeticModel(calendarId),
      date,
      fields,
      overflow,
    ).withCalendar(calendarId);
  }
  try {
    return date.add(fields, { overflow });
  } catch (error) {
    if (!(error instanceof RangeError) || !isDefectPresent("D1", calendarId)) {
      throw error;
    }
    return nonIsoDateAdd(
      readArithmeticModel(calendarId),
      date,
      fields,
      overflow,
    ).withCalendar(calendarId);
  }
}
