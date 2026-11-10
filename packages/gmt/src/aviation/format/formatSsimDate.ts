import { isOptionsArgument } from "../../internal";
import { isDateString } from "../../internal/inputChecks";
import { writeSsimDate } from "../../internal/ssimDate";
import { Temporal } from "../../internal/temporal";
import { readYearWindowStart } from "../../internal/yearWindowStart";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Write an ISO 8601 date as an SSIM schedule date. The inverse of `parseSsimDate`.
 *
 * - **What it writes.** An SSIM date is `DDMMMYY`: two digits of day, the first three letters of
 *   the month's English name in upper case, and two digits of year.
 * - **Locale-independent.** The letters are a fixed code. They are never read or written
 *   through `Intl`, so the platform's or the caller's locale changes nothing.
 * - **`value`** is a date, as `Temporal.PlainDate.from` and `isValidDate` accept it, in the ISO
 *   calendar. A date-time, an instant or a non-ISO calendar returns `""`.
 * - **The year must lie inside the window.** `options.yearWindow` is a fixed first year or
 *   `"rolling"`. A year outside the hundred years it covers returns `""`: written as two
 *   digits, it would read back as another century. So
 *   `parseSsimDate(formatSsimDate(d, o), o)` is `d` for every canonical date it writes, with the
 *   same fixed window.
 * - **Without `yearWindow`** the result is `""`.
 * - **Sources.** The day and the month letters: SSIM Chapter 6, as AECFA's _Quick Guide to Using
 *   the IATA SSIM format_ gives it. The seven-character form: EUROCONTROL's _CSST Users Guide_
 *   §3.2 Figure 1. Avinor's SSIM description shows a two-digit year in the validity period.
 *   IATA's own Chapter 7 text was not reached.
 *
 * @param value An ISO 8601 calendar date (e.g. "2026-10-25")
 * @param options The hundred-year window the year must lie in
 * @returns the `DDMMMYY` string ("25OCT26"), or "" on invalid input
 *
 * @example formatSsimDate("2026-10-25", { yearWindow: 2000 }) // "25OCT26"
 * @example formatSsimDate("2000-02-29", { yearWindow: 2000 }) // "29FEB00"
 * @example formatSsimDate("2049-12-31", { yearWindow: 1950 }) // "31DEC49"
 * @example formatSsimDate("1999-12-31", { yearWindow: 2000 }) // ""
 * @example formatSsimDate("2026-10-25", { yearWindow: "rolling" }) // "25OCT26" (while the current UTC year is 1977–2076)
 * @example formatSsimDate("2026-10-25", {}) // ""
 * @example formatSsimDate("2026-10-25T10:00", { yearWindow: 2000 }) // ""
 */
export function formatSsimDate(
  value: string,
  options: TwoDigitYearOptions,
): string {
  try {
    if (typeof value !== "string" || !isDateString(value)) {
      return "";
    }
    if (!isOptionsArgument(options)) {
      return "";
    }
    const windowStart = readYearWindowStart(options);
    if (windowStart === null) {
      return "";
    }
    const date = Temporal.PlainDate.from(value);
    if (date.year < windowStart || date.year > windowStart + 99) {
      return "";
    }
    return writeSsimDate(date.day, date.month, date.year % 100);
  } catch {
    return "";
  }
}
