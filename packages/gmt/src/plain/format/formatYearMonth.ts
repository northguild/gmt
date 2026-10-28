import { Temporal } from "../../internal/temporal";
import { normalizeDateTime } from "../../internal";
import { plainYearMonthOf } from "../../internal/inputChecks";
import { plainYearMonthFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { readDateTimeFormatOptions } from "../../internal/readDateTimeFormatOptions";
import {
  cachedFormatter,
  checkFormatterArguments,
} from "../../internal/formatterCache";

/**
 * Return a localized string for a year-month (`YYYY-MM`) using Intl options.
 *
 * - Formats as Temporal's ECMA-402 PlainYearMonth format does: only `year`, `month` and `era` are
 *   kept, at noon UTC on the first of the month.
 * - **Gregorian rule (GMT).** Always formats through the Gregorian calendar, which names the same
 *   year and month as the ISO one. ICU formats `calendar: "iso8601"` without the locale's
 *   year-month pattern (Node prints `"1970 "` with no month name), and
 *   `PlainYearMonth#toLocaleString` throws for a calendar mismatch. A `-u-ca-` subtag in `locale`
 *   is overridden. With a `calendar` option, the calendar Intl resolves must be `gregory` or
 *   `iso8601`, otherwise `""`. Intl ignores an unsupported value and uses the locale's default, so
 *   `{ calendar: "foo" }` gives `"10/2026"` in en-US and `""` in th-TH (Buddhist).
 * - **`dateStyle` (GMT rule).** `full` and `long` become `{ year: "numeric", month: "long" }`,
 *   `medium` becomes `{ year: "numeric", month: "short" }` and `short` becomes
 *   `{ year: "2-digit", month: "numeric" }`. GMT prints the same in every engine.
 * - A `day`, `weekday`, time field or `timeZoneName` is dropped; only those fields with no `year`
 *   or `month` give `""`, except `timeZoneName`, which falls back to the defaults. An `era` is
 *   kept.
 * - A year at or before 0 prints the Gregorian era year (`0000` is year 1, `-000001` is year 2)
 *   with no era unless `era` is asked for, as `formatDate` does.
 * - Returns `""` for invalid input, a `timeStyle`, invalid options, `null` options or an
 *   ill-formed locale.
 *
 * @param value ISO year-month string
 * @param locale optional BCP 47 locale identifier (default: runtime default), or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized year-month string or "" on invalid input
 *
 * @example formatYearMonth("2026-10", "en-US") // "10/2026"
 * @example formatYearMonth("2026-10", "de-DE", { year: "numeric", month: "long" }) // "Oktober 2026"
 * @example formatYearMonth("2026-10", "fr-FR", { dateStyle: "medium" }) // "oct. 2026"
 * @example formatYearMonth("2026-10", "en-US", { era: "short", year: "numeric", month: "long" }) // "October 2026 AD"
 * @example formatYearMonth("2026-10", "en-US", { year: "numeric", month: "long", day: "numeric" }) // "October 2026"
 * @example formatYearMonth("2026-10", "en-US", { timeStyle: "short" }) // ""
 * @example formatYearMonth("2026-10", "en-US", { calendar: "hebrew" }) // ""
 * @example formatYearMonth("2026-13") // ""
 */
export function formatYearMonth(
  value: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  const yearMonth = plainYearMonthOf(value);
  if (yearMonth === null) {
    return "";
  }

  try {
    const read = readDateTimeFormatOptions(options);
    checkFormatterArguments("DateTimeFormat", locale, read);
    // CreateDateTimeFormat: a year-month has no time format.
    if (read.timeStyle !== undefined) {
      return "";
    }
    if (read.calendar !== undefined) {
      const calendar = cachedFormatter("DateTimeFormat", locale, {
        calendar: read.calendar,
      }).resolvedOptions().calendar;
      if (calendar !== "gregory" && calendar !== "iso8601") {
        return "";
      }
    }
    const resolved = plainYearMonthFormatOptions(read);
    if (resolved === null) {
      return "";
    }
    // HandleDateTimeTemporalYearMonth formats noon UTC on the ISO date. -271821-04-01T12:00Z lies
    // before the earliest time value (-271821-04-20T00:00Z), and the resolved fields never include
    // a day, so any day prints the same: day 20 is the first whose noon is a time value (GMT rule).
    const epochMilliseconds = Temporal.PlainDate.from({
      year: yearMonth.year,
      month: yearMonth.month,
      day: yearMonth.year === -271821 && yearMonth.month === 4 ? 20 : 1,
    }).toZonedDateTime({
      timeZone: "UTC",
      plainTime: "12:00",
    }).epochMilliseconds;
    return normalizeDateTime(
      cachedFormatter("DateTimeFormat", locale, resolved).format(
        epochMilliseconds,
      ),
    );
  } catch {
    return "";
  }
}
