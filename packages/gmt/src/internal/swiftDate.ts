/*
 * The SWIFT value date `<DATE2>` `YYMMDD` (`240615`), SWIFT's `6!n` date, where §6.3.6 below
 * applies: field 32A of MT 910, and fields 30 and 32A of category 1 and 2 messages other than n92,
 * n95 and n96.
 * Private: a value is a date only once its year and range are known, so the public check is
 * `isValidSwiftDate(value)`, never a pattern.
 *
 * Sources:
 * - SWIFT Standards MT (2015 UHB), MT 103 field 32A: format `6!n3!a15d`; network validated rule
 *   "Date must be a valid date expressed as YYMMDD (Error code(s): T50)". In SWIFT's Knowledge
 *   Centre, which needs a login.
 * - SWIFT _Standards MT General Information_ (Standards MT November 2025, 18 July 2025), §6.3.1
 *   Dates, p. 44: "The six-digit date thus ranges from 2001 to 2060". §6.3.6 Value Date
 *   Ordering, p. 59, for MT 910 and categories 1 and 2 with field 30 or 32A, except n92, n95 and
 *   n96: "allowed: a year component … 'YY' in the range of 01 through 60"; "not allowed: any
 *   'YY' component outside of this range" (error T50). No login needed:
 *   https://www2.swift.com/knowledgecentre/rest/v1/publications/usgi_20250718/2.0/usgi_20250718.pdf
 *
 * GMT rules:
 * - Digits are ASCII only: the grammar writes `[0-9]`, not `\d`.
 * - The reader checks the shape, not the date: month `00` and day `32` come back as fields, and
 *   Temporal rejects them later, in the year the rule gives.
 * - The year is SWIFT's §6.3.6 rule applied literally (the INT-15 "No century is guessed" rule),
 *   never `internal/twoDigitYear.ts`; there is no window to choose.
 */

import { Temporal } from "./temporal";

/** The first year SWIFT accepts in a value date (Standards MT General Information, 2025, §6.3.1). */
export const SWIFT_VALUE_DATE_FIRST_YEAR = 2001;
/** The last year SWIFT accepts in a value date; any other year is error T50 (same, §6.3.6). */
export const SWIFT_VALUE_DATE_LAST_YEAR = 2060;

/** The fields of a `YYMMDD` value, as numbers: two-digit year 0–99, month 0–99, day 0–99. */
export interface SwiftDateFields {
  yy: number;
  month: number;
  day: number;
}

// No flags: `$` then fails before a trailing newline. `[0-9]`, not `\d`. Linear time.
const SWIFT_DATE = /^([0-9]{2})([0-9]{2})([0-9]{2})$/;

/** Read the fields of a `YYMMDD` value, or null when the shape does not match. */
export function readSwiftDateFields(value: string): SwiftDateFields | null {
  const match = SWIFT_DATE.exec(value);
  if (match === null) return null;
  const [, yy, mm, dd] = match as unknown as [string, string, string, string];
  return { yy: Number(yy), month: Number(mm), day: Number(dd) };
}

/**
 * The year SWIFT's value-date rule gives a two-digit `yy`, or null for error T50.
 * §6.3.6: a `YY` from 01 through 60 is allowed, and §6.3.1 reads it as 20`YY` (2001 to 2060);
 * any other `YY`, `00` and `61`–`99` included, is error T50.
 */
export function swiftValueDateYear(yy: number): number | null {
  const year = 2000 + yy;
  return year < SWIFT_VALUE_DATE_FIRST_YEAR || year > SWIFT_VALUE_DATE_LAST_YEAR
    ? null
    : year;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Write `YYMMDD` from a year 2001–2060, a month 1–12 and a day 1–31. The caller passes valid values. */
export function writeSwiftDate(
  year: number,
  month: number,
  day: number,
): string {
  return pad2(year % 100) + pad2(month) + pad2(day);
}

/**
 * The core of `parseSwiftDate` and `isValidSwiftDate`: the ISO date a SWIFT `YYMMDD` value date
 * names, or `""`. Never throws.
 *
 * @example readSwiftDate("240315") // "2024-03-15"
 * @example readSwiftDate("240230") // ""
 */
export function readSwiftDate(value: string): string {
  try {
    if (typeof value !== "string") {
      return "";
    }
    const fields = readSwiftDateFields(value);
    if (fields === null) {
      return "";
    }
    // The year is resolved before the day is checked: 040229 is in 2004, 050229 in 2005.
    const year = swiftValueDateYear(fields.yy);
    if (year === null) {
      return "";
    }
    return Temporal.PlainDate.from(
      { year, month: fields.month, day: fields.day },
      { overflow: "reject" },
    ).toString();
  } catch {
    return "";
  }
}
