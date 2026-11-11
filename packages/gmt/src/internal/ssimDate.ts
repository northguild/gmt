/*
 * The SSIM date `DDMMMYY` (`01JAN26`): a two-digit day, the first three letters of the English
 * month name in upper case, and a two-digit year. Private: a value is a date only once its
 * century is known, so the public check is `isValidSsimDate(value, options)`, never a pattern.
 *
 * Sources:
 * - The day and the month letters: AECFA (Spain), _Quick Guide to Using the IATA SSIM format_,
 *   Chapter 6: "The first two are the day of the month. Shown as 01, 02,….30, 31"; "The last
 *   three are the first three letters of the name of the month in English: JAN, FEB, ……, NOV,
 *   DEC". The guide is no longer online, so it is cited by name only.
 * - The same day and month letters, upper case: ACL (UK), _An Introductory Guide to SSIM_
 *   (April 2021), a condensed extract of Chapter 6 (`01APR`, `10JAN`),
 *   https://www.acl-uk.org/wp-content/uploads/2021/04/SSIM-Review-Final2.pdf
 * - The seven-character form with a two-digit year: EUROCONTROL, _CSST Users Guide_ Ed. 8.0
 *   (28-04-2021), §3.2 Figure 1 (`05APR10`, `16DEC09`). Avinor's SSIM description shows a
 *   two-digit year in the validity period.
 * - IATA SSIM Chapter 7, the schedule-file text itself, was not reached.
 *
 * GMT rules:
 * - The letters are a fixed English code, not a translation: no `Intl`, and no case conversion
 *   (folding case can map other characters onto a month code, `"ſEP".toUpperCase() === "SEP"`,
 *   and is locale-dependent, `"i".toLocaleUpperCase("tr") === "İ"`). Lower and mixed case
 *   are not read.
 * - Digits are ASCII only: the grammar writes `[0-9]`, not `\d`.
 * - The reader checks the shape, not the date: day `00` and day `32` come back as fields, and
 *   Temporal rejects them later.
 */

/** The SSIM month letters, January first: the first three letters of each English month name, upper case. */
export const SSIM_MONTH_LETTERS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/** The fields of a `DDMMMYY` value, as numbers: day 0–99, month 1–12, two-digit year 0–99. */
export interface SsimDateFields {
  day: number;
  month: number;
  yy: number;
}

// No `i`, `m` or `u` flag: `$` then fails before a trailing newline. Plain literals, so linear time.
const SSIM_DATE = new RegExp(
  `^([0-9]{2})(${SSIM_MONTH_LETTERS.join("|")})([0-9]{2})$`,
);

/** Read the fields of a `DDMMMYY` value, or null when the shape does not match. */
export function readSsimDateFields(value: string): SsimDateFields | null {
  const match = SSIM_DATE.exec(value);
  if (match === null) return null;
  const [, dd, mmm, yy] = match as unknown as [string, string, string, string];
  return {
    day: Number(dd),
    month:
      SSIM_MONTH_LETTERS.indexOf(mmm as (typeof SSIM_MONTH_LETTERS)[number]) +
      1,
    yy: Number(yy),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Write `DDMMMYY` from a day 1–31, a month 1–12 and a year 0–99. The caller passes valid values. */
export function writeSsimDate(day: number, month: number, yy: number): string {
  return pad2(day) + SSIM_MONTH_LETTERS[month - 1] + pad2(yy);
}
