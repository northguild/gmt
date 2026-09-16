import { Temporal } from "@js-temporal/polyfill";
import {
  ENGLISH_MONTH_NAMES,
  ENGLISH_WEEKDAY_NAMES,
} from "./englishCalendarNames";

/** Date-time fields read from an RFC 9110 HTTP-date, before calendar validation. */
export interface HttpDateFields {
  /** ISO day of week 1 (Monday) – 7 (Sunday). */
  dayOfWeek: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// RFC 9110 §5.6.7 obsolete formats. HTTP-date is case-sensitive (%s strings).
//   rfc850-date  = day-name-l "," SP date2 SP time-of-day SP GMT
//   date2        = day "-" month "-" 2DIGIT
// Capture groups: 1 day-name-l, 2 day, 3 month, 4 year, 5 hour, 6 minute, 7 second.
const RFC850_DATE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

//   asctime-date = day-name SP date3 SP time-of-day SP year
//   date3        = month SP ( 2DIGIT / ( SP 1DIGIT ))
// Capture groups: 1 day-name, 2 month, 3 day, 4 hour, 5 minute, 6 second, 7 year.
const ASCTIME_DATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}| \d) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/;

const LONG_WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function monthNumber(name: string): number {
  return (
    ENGLISH_MONTH_NAMES.indexOf(name as (typeof ENGLISH_MONTH_NAMES)[number]) +
    1
  );
}

// "Recipients of a timestamp value in rfc850-date format, which uses a
// two-digit year, MUST interpret a timestamp that appears to be more than 50
// years in the future as representing the most recent year in the past that
// had the same last two digits." The year chosen is the latest one ending in
// those digits whose timestamp is not more than 50 years after now.
function resolveTwoDigitYear(
  twoDigits: number,
  fields: Omit<HttpDateFields, "dayOfWeek" | "year">,
): number {
  const limit = Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .add({ years: 50 })
    .toPlainDateTime();
  const isBeyondLimit = (year: number): boolean =>
    Temporal.PlainDateTime.compare({ ...fields, year }, limit) > 0;
  let year = Math.floor(limit.year / 100) * 100 + twoDigits;
  while (isBeyondLimit(year)) year -= 100;
  while (!isBeyondLimit(year + 100)) year += 100;
  return year;
}

/**
 * Read the fields of an RFC 9110 obsolete HTTP-date: `rfc850-date` or
 * `asctime-date`. IMF-fixdate is read with the exported `httpDate` pattern.
 *
 * - Shape checks only: the calendar date and the day of week are left to the
 *   caller (`Temporal.PlainDateTime.from` with `overflow: "reject"`).
 * - An `rfc850-date` reads the clock (`Temporal.Now.instant`) to place its
 *   two-digit year; that call throws if the clock cannot be read.
 *
 * @param value candidate obsolete HTTP-date
 * @returns the fields, or `null` when `value` is neither obsolete format
 */
export function readObsoleteHttpDate(value: string): HttpDateFields | null {
  const rfc850 = RFC850_DATE.exec(value);
  if (rfc850 !== null) {
    const [, dayName, day, month, year, hour, minute, second] = rfc850;
    const fields = {
      month: monthNumber(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    };
    return {
      ...fields,
      dayOfWeek:
        LONG_WEEKDAY_NAMES.indexOf(
          dayName as (typeof LONG_WEEKDAY_NAMES)[number],
        ) + 1,
      year: resolveTwoDigitYear(Number(year), fields),
    };
  }

  const asctime = ASCTIME_DATE.exec(value);
  if (asctime !== null) {
    const [, dayName, month, day, hour, minute, second, year] = asctime;
    return {
      dayOfWeek:
        ENGLISH_WEEKDAY_NAMES.indexOf(
          dayName as (typeof ENGLISH_WEEKDAY_NAMES)[number],
        ) + 1,
      year: Number(year),
      month: monthNumber(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    };
  }

  return null;
}
