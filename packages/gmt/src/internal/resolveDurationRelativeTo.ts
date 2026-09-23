import { plainDate } from "../regex/date";
import { plainDateTime } from "../regex/date-time";
import type { DurationRelativeTo } from "../types";
import {
  parseCalendarDateValue,
  temporalStringLeapSecond,
} from "./calendarDateString";
import { parseCalendarZonedValue } from "./calendarZonedString";
import { hasZonedDateTimeShape, isoStringBody } from "./isoStringBody";

/**
 * A calendar annotation in any spelling: critical flag or not, any letter case. An upper-case key
 * is not Temporal syntax, so it is parsed here and throws rather than reaching Temporal later.
 */
const anyCalendarAnnotation = /\[!?u-ca=/i;

/**
 * A time zone annotation: the first bracketed annotation has no `=` (RFC 9557 §4.1; Temporal's
 * `TimeZoneAnnotation` precedes every other annotation). This only picks the branch; Temporal
 * parses the string.
 */
const timeZoneAnnotation = /^[^[]*\[!?[^=\]]*\]/;

/**
 * GMT's strict written shape for a `relativeTo` string: a string with a time zone annotation is
 * zoned (Temporal's `ParseTemporalRelativeToString` branch) and must be `zonedDateTimeBody`; any
 * other is a date or date-time.
 */
function hasRelativeToShape(value: string): boolean {
  if (timeZoneAnnotation.test(value)) {
    return hasZonedDateTimeShape(value);
  }
  const body = isoStringBody(value);
  return plainDate.test(body) || plainDateTime.test(body);
}

/**
 * Resolve a `DurationRelativeTo` value for `Temporal.Duration`'s `relativeTo` option.
 *
 * - Every string is ISO 8601 extended format before its first `[`: with a
 *   time zone annotation, the strict zoned shape (`zonedDateTimeBody`: `<date>T<time>`, then
 *   nothing, `Z` or `±HH:MM[:SS[.fraction]]`); otherwise GMT's strict date (`plainDate`) or
 *   date-time (`plainDateTime`). Basic format (`"20241003"`), a space or lower-case `t` separator,
 *   a lower-case `z`, an hour-only time or offset, a UTC offset without a time zone annotation
 *   and a zoned date without a time throw, although Temporal's `ParseTemporalRelativeToString`
 *   reads them.
 * - A string with a `u-ca` annotation is read as Temporal's `ParseTemporalRelativeToString` reads
 *   it: with a time zone annotation it is a ZonedDateTime (`"2024-02-24T00:00:00-05:00[America/New_York][u-ca=hebrew]"`,
 *   `parseCalendarZonedValue`), otherwise a PlainDate (`"2024-02-24[u-ca=hebrew]"`, or a date-time
 *   whose time Temporal drops, `parseCalendarDateValue`). Annotations follow Temporal's
 *   grammar: elective unknown ones are ignored, the first `u-ca` wins, and an unknown critical
 *   annotation, a critical duplicate calendar, a calendar before the zone and `;era=` throw. The
 *   calendar must be a `CalendarSystem`, and `"ethiopic"`/`"coptic"` compute in `"ethioaa"`,
 *   which polyfill 0.5.1 can read. The digits are ISO, so this is the date Temporal itself would
 *   read.
 * - A leap second (second `60`) throws, in every spelling Temporal's grammar accepts — `T`, `t`
 *   or space separator, extended or basic digits, with or without a designator. Temporal's
 *   ParseISODateTime would otherwise clamp it to `:59`.
 * - Every other `relativeTo` (a strict extended string without a calendar annotation, or a `PlainDate`/`PlainDateTime`/
 *   `ZonedDateTime` object or `-Like`) passes through unchanged.
 *
 * A PlainDate string resolves to a `Temporal.PlainDateTime` (midnight, same calendar) only because
 * the polyfill's TypeScript declaration and GMT's `DurationRelativeTo` type list `PlainDateTime`,
 * not `PlainDate`. Temporal's `GetTemporalRelativeToOption` converts a `PlainDateTime` with
 * `CreateTemporalDate` and drops the time, so the result is identical.
 *
 * Throws on invalid input. Callers already wrap the Temporal call consuming this in
 * `try { ... } catch { return sentinel }` per GMT's contract.
 */
export function resolveDurationRelativeTo(
  relativeTo: DurationRelativeTo | undefined,
): DurationRelativeTo | undefined {
  if (typeof relativeTo !== "string") {
    return relativeTo;
  }
  if (temporalStringLeapSecond.test(relativeTo)) {
    throw new RangeError(`Leap seconds are not supported: ${relativeTo}`);
  }
  if (!hasRelativeToShape(relativeTo)) {
    throw new RangeError(
      `Not an extended ISO 8601 date, date-time or zoned date-time: ${relativeTo}`,
    );
  }
  if (!anyCalendarAnnotation.test(relativeTo)) {
    return relativeTo;
  }
  if (timeZoneAnnotation.test(relativeTo)) {
    return parseCalendarZonedValue(relativeTo);
  }
  return parseCalendarDateValue(relativeTo).toPlainDateTime();
}
