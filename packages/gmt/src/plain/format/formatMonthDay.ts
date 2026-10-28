import { Temporal } from "../../internal/temporal";
import { normalizeDateTime } from "../../internal";
import { plainMonthDayOf } from "../../internal/inputChecks";
import { REFERENCE_ISO_YEAR } from "../../internal/monthDay";
import { plainMonthDayFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { readDateTimeFormatOptions } from "../../internal/readDateTimeFormatOptions";
import {
  cachedFormatter,
  checkFormatterArguments,
} from "../../internal/formatterCache";

/**
 * Return a localized string for a month-day (`--MM-DD` or `MM-DD`) using Intl options.
 *
 * - Formats as Temporal's ECMA-402 PlainMonthDay format does: only `month` and `day` are kept, at
 *   noon UTC on the ISO date in the 1972 reference year (so `--02-29` formats). The year is never
 *   printed.
 * - **Gregorian rule (GMT).** Always formats through the Gregorian calendar, which names the same
 *   month and day as the ISO one. ICU formats `calendar: "iso8601"` without the locale's month-day
 *   pattern (Node prints `" 25"`, browsers `Dezember 25` for de-DE), and
 *   `PlainMonthDay#toLocaleString` throws for a calendar mismatch. A `-u-ca-` subtag in `locale` is
 *   overridden. With a `calendar` option, the calendar Intl resolves must be `gregory` or
 *   `iso8601`, otherwise `""`. Intl ignores an unsupported value and uses the locale's default, so
 *   `{ calendar: "foo" }` gives `"12/25"` in en-US and `""` in th-TH (Buddhist).
 * - **`dateStyle` (GMT rule).** `full` and `long` become `{ month: "long", day: "numeric" }`,
 *   `medium` becomes `{ month: "short", day: "numeric" }` and `short` becomes
 *   `{ month: "numeric", day: "numeric" }`. This is the mapping polyfill 0.5.1's `toLocaleString`
 *   uses. Native engines take the widths from the locale's own date pattern, so there
 *   `toLocaleString` prints, for example, `25.12.` for de-DE `medium` and `12/25` for zh-CN `long`.
 *   GMT prints the same in every engine.
 * - A `year`, `weekday`, `era`, time field or `timeZoneName` is dropped; only those fields with no
 *   `month` or `day` give `""`, except `era` and `timeZoneName`, which fall back to the defaults.
 * - Returns `""` for invalid input, a `timeStyle`, invalid options, `null` options or an
 *   ill-formed locale.
 *
 * @param value ISO month-day string
 * @param locale optional BCP 47 locale identifier (default: runtime default), or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized month-day string or "" on invalid input
 *
 * @example formatMonthDay("--12-25", "en-US") // "12/25"
 * @example formatMonthDay("--12-25", "de-DE", { month: "long", day: "numeric" }) // "25. Dezember"
 * @example formatMonthDay("--12-25", "fr-FR", { dateStyle: "medium" }) // "25 déc."
 * @example formatMonthDay("--02-29", "en-US", { month: "long", day: "numeric" }) // "February 29"
 * @example formatMonthDay("--12-25", "en-US", { year: "numeric", month: "long", day: "numeric" }) // "December 25"
 * @example formatMonthDay("--12-25", "en-US", { timeStyle: "short" }) // ""
 * @example formatMonthDay("--12-25", "en-US", { calendar: "hebrew" }) // ""
 * @example formatMonthDay("--02-30") // ""
 */
export function formatMonthDay(
  value: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  const monthDay = plainMonthDayOf(value);
  if (monthDay === null) {
    return "";
  }

  try {
    const read = readDateTimeFormatOptions(options);
    checkFormatterArguments("DateTimeFormat", locale, read);
    // CreateDateTimeFormat: a month-day has no time format.
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
    const resolved = plainMonthDayFormatOptions(read);
    if (resolved === null) {
      return "";
    }
    // HandleDateTimeTemporalMonthDay formats noon UTC on the ISO date.
    const epochMilliseconds = Temporal.PlainDate.from({
      year: REFERENCE_ISO_YEAR,
      monthCode: monthDay.monthCode,
      day: monthDay.day,
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
