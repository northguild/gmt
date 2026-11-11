/*
 * The SWIFT value date `<DATE2>` `YYMMDD` (`240615`), SWIFT's `6!n` date of MT fields 30 and 32A.
 * Private: a value is a date only once its century and range are known, so the public check is
 * `isValidSwiftDate(value)`, never a pattern.
 *
 * Sources (SWIFT's own copies need a login; both were read through a public mirror of SWIFT's
 * User Handbook):
 * - SWIFT Standards MT (2015 UHB), MT 103 field 32A: format `6!n3!a15d`; network validated rule
 *   "Date must be a valid date expressed as YYMMDD (Error code(s): T50)".
 *   https://pinas.synology.me/Swift_Manual/2015/books/us1m/aih006.htm
 * - SWIFT _Message Format Validation Rules_ (Nov 2006), Part II §4.1 Date: "`<DATE2>` YYMMDD";
 *   "all 'Y', 'M', and 'D' characters must be numeric characters : i.e. figures 0, 1, 2, 3, 4, 5,
 *   6, 7, 8, 9"; "Standard presentation: `<DATE2>` 6!n"; month "00<MM<13"; "'DD' check: this
 *   check depends upon the 'YY' or 'YYYY', and 'MM' values"; "Leap years are accommodated";
 *   "The code error "T50" is returned after a format error".
 *   https://pinas.synology.me/Swift_Manual/2006/FINAL/UTMF/PTII.PDF
 * - The same, §4.1.1 Value Date: "The valid range of value dates implemented on the SWII system
 *   is from 1980 to 2060 (limits included)"; "IF YY >79 THEN year = "19" || "YY" ELSE year =
 *   "20" || "YY" ENDIF IF year > 2060 THEN <error:'T50'> ENDIF"; "This validation is in
 *   addition to the <DATE2> format validation". The rule reaches MT 910 field 32A, and
 *   categories 1 and 2 with field 30 and/or 32A, except n92, n95 and n96.
 *
 * GMT rules:
 * - Digits are ASCII only: the grammar writes `[0-9]`, not `\d`.
 * - The reader checks the shape, not the date: month `00` and day `32` come back as fields, and
 *   Temporal rejects them later, in the year the century rule gives.
 * - The century is SWIFT's §4.1.1 rule applied literally (the INT-15 "No century is guessed"
 *   rule), never `internal/twoDigitYear.ts`; there is no window to choose.
 */

/** The first year SWIFT accepts in a value date (Message Format Validation Rules, Nov 2006, Part II §4.1.1). */
export const SWIFT_VALUE_DATE_FIRST_YEAR = 1980;
/** The last year SWIFT accepts in a value date; a later year is error T50 (same clause). */
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
 * §4.1.1: IF YY > 79 THEN year = "19" || YY ELSE year = "20" || YY; IF year > 2060 THEN T50.
 */
export function swiftValueDateYear(yy: number): number | null {
  const year = yy > 79 ? 1900 + yy : 2000 + yy;
  return year > SWIFT_VALUE_DATE_LAST_YEAR ? null : year;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Write `YYMMDD` from a year 1980–2060, a month 1–12 and a day 1–31. The caller passes valid values. */
export function writeSwiftDate(
  year: number,
  month: number,
  day: number,
): string {
  return pad2(year % 100) + pad2(month) + pad2(day);
}
