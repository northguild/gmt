import { isOptionsArgument } from "../../internal";
import { readSsimDateFields } from "../../internal/ssimDate";
import { Temporal } from "../../internal/temporal";
import { twoDigitYear } from "../../internal/twoDigitYear";
import { readYearWindowStart } from "../../internal/yearWindowStart";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Parse an SSIM schedule date as an ISO 8601 date.
 *
 * - **What it reads.** An SSIM date is `DDMMMYY`: two digits of day, the first three letters of
 *   the month's English name in upper case (`JAN` … `DEC`), and two digits of year. The result
 *   is an ISO `PlainDate` string.
 * - **Locale-independent.** The month letters are a fixed code, not a translation. They are
 *   never read through `Intl`, so the platform's or the caller's locale changes nothing. Lower
 *   and mixed case (`jan`, `Jan`) and other languages (`ENE`, `JANV`) return `""`.
 * - **The century is the caller's.** `options.yearWindow` places `YY` in a hundred-year window:
 *   a fixed first year, for stored schedules, or `"rolling"`, for live feeds. Without
 *   `yearWindow` the result is `""`.
 * - **Days must exist.** A day that does not exist in that month and windowed year returns `""`.
 *   `29FEB00` is a date in a window from 2000, and not in one from 1900.
 * - **Sources.** The day and the month letters: SSIM Chapter 6, as two guides give it. They are
 *   ACL's _An Introductory Guide to SSIM_ (April 2021), which shows `01APR`, and AECFA's
 *   _Quick Guide to Using the IATA SSIM format_, which is no longer online. The seven-character
 *   form: EUROCONTROL's _CSST Users Guide_ §3.2 Figure 1. Avinor's SSIM description shows a
 *   two-digit year in the validity period. IATA's own Chapter 7 text was not reached.
 *
 * @param value An SSIM date, `DDMMMYY` (e.g. "01JAN26")
 * @param options The hundred-year window a two-digit year is read in
 * @returns the ISO date ("2026-01-01"), or "" on invalid input
 *
 * @example parseSsimDate("01JAN26", { yearWindow: 2000 }) // "2026-01-01"
 * @example parseSsimDate("29FEB00", { yearWindow: 2000 }) // "2000-02-29"
 * @example parseSsimDate("29FEB00", { yearWindow: 1900 }) // ""
 * @example parseSsimDate("16DEC09", { yearWindow: 1950 }) // "2009-12-16"
 * @example parseSsimDate("01JAN26", { yearWindow: "rolling" }) // "2026-01-01" (while the current UTC year is 1977–2076)
 * @example parseSsimDate("01jan26", { yearWindow: 2000 }) // ""
 * @example parseSsimDate("01ENE26", { yearWindow: 2000 }) // ""
 * @example parseSsimDate("01JAN26", {}) // ""
 */
export function parseSsimDate(
  value: string,
  options: TwoDigitYearOptions,
): string {
  try {
    if (typeof value !== "string") {
      return "";
    }
    if (!isOptionsArgument(options)) {
      return "";
    }
    const fields = readSsimDateFields(value);
    if (fields === null) {
      return "";
    }
    const windowStart = readYearWindowStart(options);
    if (windowStart === null) {
      return "";
    }
    return Temporal.PlainDate.from(
      {
        year: twoDigitYear(fields.yy, windowStart),
        month: fields.month,
        day: fields.day,
      },
      { overflow: "reject" },
    ).toString();
  } catch {
    return "";
  }
}
