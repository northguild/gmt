import { dateFromFixed, fixedFromIso, isIsoLeapYear, mod } from "./fixedDay";
import type { ArithmeticModel } from "./nonIsoArithmetic";

/*
 * The Indian national (Saka) calendar, as adopted on the recommendation of the Calendar Reform
 * Committee (Government of India, 1955) and described in the *Explanatory Supplement to the
 * Astronomical Almanac* (Indian National Calendar): Chaitra 1 is March 22, or March 21 in a
 * Gregorian leap year; Chaitra has 30 days (31 in a Gregorian leap year), Vaishakha to Bhadra 31
 * each, Ashvina to Phalguna 30 each; the Saka year is the Gregorian year of its Chaitra 1 minus 78.
 * Chromium 152 (ICU4X) matches this rule for every scanned date before ISO year 1.
 *
 * WHY GMT OWNS IT (CORE-6 owner decision, Q4): polyfill 0.5.1's "V8 bug 10529" detector compares
 * against `'10/11/-79 Saka'` while ICU 78 prints `Śaka`, so it throws for every ISO year < 1
 * although ICU is correct (D5). Used only while the D5 probe fails, and only for those dates.
 *
 * Remove when a js-temporal release ports proposal-temporal 314b112 (see README.md).
 */

/** Saka year = Gregorian year of its Chaitra 1 minus this. */
export const SAKA_YEAR_OFFSET = 78;
const MONTHS_PER_YEAR = 12;
/** Chaitra is month 1; Vaishakha (2) to Bhadra (6) have 31 days, Ashvina (7) to Phalguna (12) 30. */
const LAST_31_DAY_MONTH = 6;

export interface IndianFields {
  year: number;
  month: number;
  monthCode: string;
  day: number;
}

function chaitraOne(gregorianYear: number): number {
  return fixedFromIso(gregorianYear, 3, isIsoLeapYear(gregorianYear) ? 21 : 22);
}

function monthLength(sakaYear: number, month: number): number {
  if (month === 1) {
    return isIsoLeapYear(sakaYear + SAKA_YEAR_OFFSET) ? 31 : 30;
  }
  return month <= LAST_31_DAY_MONTH ? 31 : 30;
}

/** The Saka year, month, month code and day of a proleptic Gregorian (ISO) date. */
export function indianFieldsFromIso(
  isoYear: number,
  isoMonth: number,
  isoDay: number,
): IndianFields {
  const fixed = fixedFromIso(isoYear, isoMonth, isoDay);
  const gregorianYear = fixed < chaitraOne(isoYear) ? isoYear - 1 : isoYear;
  const year = gregorianYear - SAKA_YEAR_OFFSET;
  let remaining = fixed - chaitraOne(gregorianYear);
  for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
    const length = monthLength(year, month);
    if (remaining < length) {
      return {
        year,
        month,
        monthCode: `M${String(month).padStart(2, "0")}`,
        day: remaining + 1,
      };
    }
    remaining -= length;
  }
  throw new RangeError(
    `${isoYear}-${isoMonth}-${isoDay} is past its Saka year`,
  );
}

/**
 * The Indian calendar as an integer arithmetic model for `nonIsoArithmetic.ts`, so add and until
 * are correct before ISO year 1 too (D5). Every answer is this file's arithmetic.
 */
export const indianArithmeticModel: ArithmeticModel = {
  calendarId: "indian",
  fields(date) {
    const iso = date.withCalendar("iso8601");
    return indianFieldsFromIso(iso.year, iso.month, iso.day);
  },
  monthOrdinal(_year, monthCode) {
    const month = /^M(\d{2})$/.exec(monthCode);
    const ordinal = month ? Number(month[1]) : 0;
    return ordinal >= 1 && ordinal <= MONTHS_PER_YEAR ? ordinal : "missing";
  },
  addMonths({ year, month }, months) {
    const index = year * MONTHS_PER_YEAR + month - 1 + months;
    return {
      year: Math.floor(index / MONTHS_PER_YEAR),
      month: mod(index, MONTHS_PER_YEAR) + 1,
    };
  },
  monthsBetween: (from, to) =>
    (to.year - from.year) * MONTHS_PER_YEAR + to.month - from.month,
  daysInMonth: ({ year, month }) => monthLength(year, month),
  toDate(year, month, day) {
    if (
      month < 1 ||
      month > MONTHS_PER_YEAR ||
      day < 1 ||
      day > monthLength(year, month)
    ) {
      throw new RangeError(`No Indian date ${year}-${month}-${day}`);
    }
    let fixed = chaitraOne(year + SAKA_YEAR_OFFSET) + day - 1;
    for (let earlier = 1; earlier < month; earlier++) {
      fixed += monthLength(year, earlier);
    }
    return dateFromFixed(fixed);
  },
};
