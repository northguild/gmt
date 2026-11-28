import type { DurationRelativeTo } from "../types";
import type { Temporal } from "./temporal";
import {
  parseCalendarDateValue,
  temporalStringLeapSecond,
} from "./calendarDateString";
import { parseCalendarZonedValue } from "./calendarZonedString";
import { hasCalendarDateShape, hasCalendarZonedShape } from "./isoStringBody";
import { zonedDateTimeFrom } from "./zonedWallClock";

/**
 * What `resolveDurationRelativeTo` hands to Temporal: the string itself, or the object GMT read
 * from a calendar-annotated or zoned string.
 */
export type ResolvedRelativeTo =
  | string
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime;

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
 * GMT's strict written shape for a `relativeTo` string, over the whole string: a zoned date-time
 * (`hasCalendarZonedShape`: `<date>T<time>`, optional `Z` or offset, one time zone annotation) or a
 * date or date-time (`hasCalendarDateShape`), each with at most one calendar annotation. Nothing
 * else follows: no elective annotation, no second zone, no time zone on a plain value.
 */
function hasRelativeToShape(value: string): boolean {
  return hasCalendarZonedShape(value) || hasCalendarDateShape(value);
}

/**
 * Resolve a `DurationRelativeTo` value for `Temporal.Duration`'s `relativeTo` option.
 *
 * - Every string is ISO 8601 extended format and nothing else: with a time zone annotation, the
 *   strict zoned shape (`<date>T<time>`, then nothing, `Z` or `±HH:MM[:SS[.fraction]]`, then the
 *   zone); otherwise GMT's strict date (`plainDate`) or date-time (`plainDateTime`). Either may
 *   carry one calendar annotation; any other annotation (an elective `[foo=bar]`, a second `u-ca`)
 *   throws. Basic format (`"20241003"`), a space or lower-case `t` separator,
 *   a lower-case `z`, an hour-only time or offset, a UTC offset without a time zone annotation
 *   and a zoned date without a time throw, although Temporal's `ParseTemporalRelativeToString`
 *   reads them.
 * - A string with a `u-ca` annotation is read as Temporal's `ParseTemporalRelativeToString` reads
 *   it: with a time zone annotation it is a ZonedDateTime (`"2024-02-24T00:00:00+02:00[Asia/Jerusalem][u-ca=hebrew]"`,
 *   `parseCalendarZonedValue`), otherwise a PlainDate (`"2024-02-24[u-ca=hebrew]"`, or a date-time
 *   whose time Temporal drops, `parseCalendarDateValue`). Annotations follow Temporal's
 *   rules: at most one `u-ca` after the body (and the zone, for the zoned form). An elective
 *   unknown annotation, a second `u-ca`, an unknown critical annotation, a calendar before the
 *   zone and `;era=` are rejected. The calendar must be a `CalendarSystem`. The digits are ISO, so
 *   this is the date Temporal itself would read.
 * - A zoned string without a calendar annotation is read with `zonedDateTimeFrom`, so its offset
 *   is matched against the zone as TC39 `ToRelativeTemporalObject` matches it: an offset written
 *   to the minute may be the zone's sub-minute offset rounded, and one written with seconds must
 *   be the zone's offset exactly (`"1970-01-01T00:00:00-00:45:00[Africa/Monrovia]"` throws).
 * - A leap second (second `60`) throws, in every spelling Temporal's grammar accepts — `T`, `t`
 *   or space separator, extended or basic digits, with or without a designator. Temporal's
 *   ParseISODateTime would otherwise clamp it to `:59`.
 * - Every other string (a strict extended string without a time zone or calendar annotation) passes
 *   through unchanged. `undefined` is no anchor. Any other value (a `Temporal` object, a property
 *   bag, a number, `null`) throws `TypeError`: `relativeTo` is a string, and Temporal would clamp an
 *   invalid property bag (`{ year: 2024, month: 2, day: 30 }` is 29 February).
 *
 * A calendar-annotated plain string resolves to a `Temporal.PlainDate`, as Temporal's
 * `GetTemporalRelativeToOption` makes it with `CreateTemporalDate`. That checks only
 * `ISODateWithinLimits`, so `"-271821-04-19[u-ca=gregory]"` is a valid `relativeTo` although
 * midnight on that date is not a valid `PlainDateTime`.
 *
 * Throws on invalid input. Callers already wrap the Temporal call consuming this in
 * `try { ... } catch { return sentinel }` per GMT's contract.
 */
export function resolveDurationRelativeTo(
  relativeTo: DurationRelativeTo | undefined,
): ResolvedRelativeTo | undefined {
  if (relativeTo === undefined) {
    return undefined;
  }
  if (typeof relativeTo !== "string") {
    throw new TypeError("relativeTo must be an ISO 8601 string");
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
    // Read once here, so every caller gets a ZonedDateTime and a bad offset throws in this
    // function (TC39 `ToRelativeTemporalObject`), not later in the caller's Temporal call.
    return timeZoneAnnotation.test(relativeTo)
      ? zonedDateTimeFrom(relativeTo)
      : relativeTo;
  }
  if (timeZoneAnnotation.test(relativeTo)) {
    return parseCalendarZonedValue(relativeTo);
  }
  return parseCalendarDateValue(relativeTo);
}
