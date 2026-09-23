import { Temporal } from "@js-temporal/polyfill";
import { ENGLISH_MONTH_NAMES, ENGLISH_WEEKDAY_NAMES } from "../../internal";
import {
  type HttpDateFields,
  readObsoleteHttpDate,
} from "../../internal/httpDateFields";
import { httpDate } from "../../regex";

/**
 * Parse an RFC 9110 HTTP-date — the fixed grammar HTTP headers like
 * `Last-Modified`/`Date`/`Expires` use — into a UTC ISO 8601 datetime string.
 *
 * - **Decoding, not display.** Accepts English weekday/month names only, per
 *   the fixed grammar (see `formatHttp`'s JSDoc and roadmap Decision 1).
 * - **All three HTTP-date formats**, as RFC 9110 §5.6.7 requires ("A
 *   recipient that parses a timestamp value in an HTTP field MUST accept all
 *   three"): IMF-fixdate (`Sun, 06 Nov 1994 08:49:37 GMT`), the obsolete
 *   rfc850-date (`Sunday, 06-Nov-94 08:49:37 GMT`) and asctime-date
 *   (`Sun Nov  6 08:49:37 1994`, read as UTC).
 * - HTTP-date is case-sensitive and fixed-width: exactly the spacing, digit
 *   counts and the literal `GMT` of the grammar. No numeric offset is
 *   accepted.
 * - **rfc850-date years read the clock.** Its two-digit year becomes the
 *   latest year ending in those digits whose timestamp is not more than 50
 *   years after now (`Temporal.Now.instant()`), per RFC 9110: "a timestamp
 *   that appears to be more than 50 years in the future" is "the most recent
 *   year in the past that had the same last two digits". The same string can
 *   therefore parse differently decades apart; if the clock cannot be read
 *   the result is `""`.
 * - **The day name must match the date, in all three formats.** RFC 9110 gives it
 *   RFC 5322's semantics: "the day-of-week (if included) MUST be the day implied by
 *   the date". A mismatch returns `""` — deliberately in asctime-date too, where the
 *   day name is not separated by a comma and so is easy to overlook. `Mon Nov  6
 *   08:49:37 1994` is `""`, exactly as `Mon, 06 Nov 1994 08:49:37 GMT` and
 *   `Monday, 06-Nov-94 08:49:37 GMT` are: 6 November 1994 was a Sunday. A parser that
 *   accepted the mismatch would have to pick which of the two fields to believe, and
 *   there is no rule in RFC 9110 that says which.
 * - An impossible calendar date (`31 Feb`, `29 Feb 2023`) returns `""`: a parser never
 *   invents a date, so fields are validated with `overflow: "reject"`, not clamped.
 * - For the IMF-fixdate shape alone, test the exported `httpDate` pattern.
 * - **Compatibility:** before 1.16.0 a day name that did not match the date was ignored.
 *   Parse the same fields as an RFC 5322 date-time without the day name, then convert.
 *
 * @param value RFC 9110 HTTP-date string (e.g. "Fri, 15 Mar 2024 14:30:00 GMT")
 * @returns UTC ISO 8601 datetime string, or "" on invalid input
 *
 * @example parseHttp("Fri, 15 Mar 2024 14:30:00 GMT") // "2024-03-15T14:30:00Z"
 * @example parseHttp("Sunday, 06-Nov-94 08:49:37 GMT") // "1994-11-06T08:49:37Z" (rfc850-date)
 * @example parseHttp("Sun Nov  6 08:49:37 1994") // "1994-11-06T08:49:37Z" (asctime-date)
 * @example parseHttp("Fri, 15 Mar 2024 14:30:00 -0400") // "" (not an HTTP-date)
 * @example parseHttp("Sat, 15 Mar 2024 14:30:00 GMT") // "" (15 Mar 2024 was a Friday)
 * @example parseHttp("Mon Nov  6 08:49:37 1994") // "" (asctime-date; 6 Nov 1994 was a Sunday)
 * @example convertZonedToUtc(parseRfc2822("15 Mar 2024 14:30:00 GMT")) // "2024-03-15T14:30:00Z" — the day name removed
 * @example parseHttp("Sat, 31 Feb 2024 14:30:00 GMT") // "" (impossible date)
 * @example parseHttp("not a date") // ""
 */
export function parseHttp(value: string): string {
  if (typeof value !== "string") return "";

  try {
    const fields = readHttpDate(value);
    if (fields === null) return "";

    const plainDateTime = Temporal.PlainDateTime.from(
      {
        year: fields.year,
        month: fields.month,
        day: fields.day,
        hour: fields.hour,
        minute: fields.minute,
        second: fields.second,
      },
      { overflow: "reject" },
    );
    // RFC 9110 gives day-name RFC 5322's semantics: "the day-of-week (if
    // included) MUST be the day implied by the date".
    if (fields.dayOfWeek !== plainDateTime.dayOfWeek) return "";

    return plainDateTime.toZonedDateTime("UTC").toInstant().toString();
  } catch {
    return "";
  }
}

function readHttpDate(value: string): HttpDateFields | null {
  const match = httpDate.exec(value);
  if (match === null) return readObsoleteHttpDate(value);

  const [, dayName, day, month, year, hour, minute, second] = match;
  return {
    dayOfWeek:
      ENGLISH_WEEKDAY_NAMES.indexOf(
        dayName as (typeof ENGLISH_WEEKDAY_NAMES)[number],
      ) + 1,
    year: Number(year),
    month:
      ENGLISH_MONTH_NAMES.indexOf(
        month as (typeof ENGLISH_MONTH_NAMES)[number],
      ) + 1,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}
