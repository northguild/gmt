import { plainDate } from "../regex/date";
import { plainDateTime } from "../regex/date-time";
import { plainTime } from "../regex/time";

/**
 * The part of a string before its first `[`: everything before it, or the whole string when it
 * has none. For a caller that has already matched the whole string against its kind's exact
 * pattern and needs the written part alone (a zoned string's wall clock and offset, say). It is
 * never a validity check: every GMT reader matches its kind's pattern over the WHOLE string
 * (`hasZonedDateTimeShape`, `hasInstantShape`, `hasCalendarDateShape`, the `regex/` patterns), so
 * no annotation GMT's kind does not define (a time zone on a plain value, `[foo=bar]`, a second
 * `u-ca`) reaches Temporal, which would read and drop it.
 *
 * @param value candidate ISO 8601 string
 * @returns the string up to its first `[`, or `""` for a non-string
 *
 * @example isoStringBody("2024-03-10T12:30+02:00[Europe/Helsinki]") // "2024-03-10T12:30+02:00"
 * @example isoStringBody("12:30") // "12:30"
 */
export function isoStringBody(value: string): string {
  if (typeof value !== "string") {
    return "";
  }
  const annotationStart = value.indexOf("[");
  return annotationStart === -1 ? value : value.slice(0, annotationStart);
}

/**
 * An ISO 8601 extended UTC offset, as RFC 3339 §5.6 `time-numoffset` writes it (`±HH:MM`), with
 * the seconds and fraction Temporal's `UTCOffset` grammar adds (`±HH:MM:SS[.fraction]`, the
 * fraction after either decimal sign, `.` or `,`, as `TemporalDecimalSeparator` allows). Hours
 * 00–23. Basic (`-0400`) and hour-only (`-04`) offsets, which Temporal also reads, do not match.
 *
 * A regular-expression source with no anchors and no capture groups, so callers can embed it:
 * GMT's one statement of the offset grammar its instant and zoned validators accept.
 *
 * @example new RegExp(`^${EXTENDED_UTC_OFFSET}$`).test("+05:30:00,5") // true
 * @example new RegExp(`^${EXTENDED_UTC_OFFSET}$`).test("-0400") // false (basic format)
 */
export const EXTENDED_UTC_OFFSET =
  "[+-](?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:[.,]\\d{1,9})?)?";

/**
 * An RFC 9557 time-zone annotation: a bracket whose content has no `=` (§4.1 `time-zone`,
 * against `suffix-tag`'s `key=value`), with an optional leading `!` marking it critical (§3.3).
 * `[Europe/London]`, `[!+01:00]`; never `[u-ca=hebrew]`, `[!foo=bar]`, `[ junk ]` or the basic-form
 * offsets `[+0100]` and `[+01]`. Every `key=value`
 * bracket is a tagged annotation, which Temporal reads (or rejects) on its own.
 *
 * A regular-expression source with no anchors and no capture groups, so callers can embed or
 * anchor it: GMT's one statement of "this bracket names a time zone".
 *
 * @example new RegExp(TIME_ZONE_ANNOTATION).test("2024-06-15T10:00:00Z[!Europe/London]") // true
 * @example new RegExp(TIME_ZONE_ANNOTATION).test("2024-06-15T10:00:00Z[u-ca=gregory]") // false
 */
export const TIME_ZONE_ANNOTATION =
  // RFC 9557 §4.1 `time-zone`: an IANA name (`/`-joined parts that start with a letter, `.` or `_`,
  // then letters, digits, `.`, `_`, `-` or `+`; a whole part of `.` or `..` is excluded, which the
  // lookahead before each part checks: that part is followed by `/` or the closing bracket) or an
  // extended-form offset (RFC 3339 §5.6 `±HH:MM`).
  "\\[!?(?:(?!\\.{1,2}[/\\]])[A-Za-z._][A-Za-z0-9._+-]*(?:/(?!\\.{1,2}[/\\]])[A-Za-z._][A-Za-z0-9._+-]*)*|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])\\]";

/**
 * An RFC 9557 calendar annotation: `[u-ca=<id>]` or the critical `[!u-ca=<id>]`, the id one or
 * more alphanumeric runs joined by hyphens (`iso8601`, `islamic-civil`). Temporal canonicalizes
 * the id and GMT then checks it names a supported calendar.
 *
 * A regular-expression source with no anchors and no capture groups.
 *
 * @example new RegExp(CALENDAR_ANNOTATION).test("[u-ca=hebrew]") // true
 * @example new RegExp(CALENDAR_ANNOTATION).test("[foo=bar]") // false
 */
export const CALENDAR_ANNOTATION =
  "\\[!?u-ca=[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\\]";

/** `plainDate` without its anchors: `YYYY-MM-DD`. */
const EXTENDED_DATE = plainDate.source.slice(1, -1);

/** `plainDateTime` without its anchors: `<date>T<time>` with an optional fraction. */
const EXTENDED_DATE_TIME = plainDateTime.source.slice(1, -1);

/**
 * A zoned datetime string, over the whole string, in GMT's strict ISO 8601 extended shape:
 * `<date>T<time>` exactly as `plainDateTime` matches it, then nothing, an upper-case `Z`, or an
 * extended offset (`±HH:MM[:SS[.fraction]]`), then exactly one time-zone annotation
 * (`TIME_ZONE_ANNOTATION`) and nothing more. `Temporal.ZonedDateTime.from` reads more (basic
 * format, a space or lower-case `t`, hour-only times, a date with no time, elective and calendar
 * annotations); GMT rejects all of it, so it never reaches Temporal.
 *
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00-04:00[America/New_York]") // true
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00[America/New_York]") // true
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00-04:00") // false (no zone)
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00[America/New_York][u-ca=iso8601]") // false (calendar annotation)
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00[America/New_York][foo=bar]") // false (elective annotation)
 * @example hasZonedDateTimeShape("20241003T143000-0400[America/New_York]") // false (basic format)
 */
const zonedDateTime: RegExp = new RegExp(
  `^${EXTENDED_DATE_TIME}(?:Z|${EXTENDED_UTC_OFFSET})?${TIME_ZONE_ANNOTATION}$`,
);

/** `zonedDateTime` with the `Z` or offset required: a zoned string that also writes its instant. */
const zonedInstant: RegExp = new RegExp(
  `^${EXTENDED_DATE_TIME}(?:Z|${EXTENDED_UTC_OFFSET})${TIME_ZONE_ANNOTATION}$`,
);

/** `zonedDateTime` plus at most one calendar annotation after the zone. */
const calendarZonedDateTime: RegExp = new RegExp(
  `^${EXTENDED_DATE_TIME}(?:Z|${EXTENDED_UTC_OFFSET})?${TIME_ZONE_ANNOTATION}(?:${CALENDAR_ANNOTATION})?$`,
);

/** A date or date-time, then at most one calendar annotation. */
const calendarDate: RegExp = new RegExp(
  `^(?:${EXTENDED_DATE_TIME}|${EXTENDED_DATE})(?:${CALENDAR_ANNOTATION})?$`,
);

/**
 * An instant string, over the whole string, in GMT's strict ISO 8601 extended shape: the
 * `<date>T<time>` of `plainDateTime`, then `Z` or `±HH:MM[:SS[.fraction]]`, and nothing after.
 * No annotation of any kind: an instant names no zone and no calendar. `Temporal.Instant.from`
 * also reads basic format, `t`/space separators, `z`, hour-only offsets and annotations; GMT
 * rejects them.
 */
const instant: RegExp = new RegExp(
  `^${EXTENDED_DATE_TIME}(?:Z|${EXTENDED_UTC_OFFSET})$`,
);

/**
 * True when `value` is a zoned datetime string in GMT's exact shape: wall clock, optional offset,
 * one time-zone annotation, nothing else (see `zonedDateTime`).
 *
 * @param value candidate zoned datetime string
 * @returns whether the whole string has the strict zoned shape
 *
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00+05:30[Asia/Kolkata]") // true
 * @example hasZonedDateTimeShape("2024-10-03 14:30:00+05:30[Asia/Kolkata]") // false
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00+05:30[Asia/Kolkata][foo=bar]") // false
 */
export function hasZonedDateTimeShape(value: string): boolean {
  return typeof value === "string" && zonedDateTime.test(value);
}

/**
 * True when `value` is a zoned datetime string that also writes its offset or `Z`
 * (`2024-10-03T14:30:00+05:30[Asia/Kolkata]`), nothing else.
 *
 * @param value candidate zoned datetime string
 * @returns whether the whole string has the strict zoned shape with a written offset
 *
 * @example hasZonedInstantShape("2024-10-03T14:30:00+05:30[Asia/Kolkata]") // true
 * @example hasZonedInstantShape("2024-10-03T14:30:00[Asia/Kolkata]") // false
 */
export function hasZonedInstantShape(value: string): boolean {
  return typeof value === "string" && zonedInstant.test(value);
}

/**
 * True when `value` is a zoned datetime string with at most one calendar annotation after the
 * zone (`2024-02-24T14:30:00+02:00[Asia/Jerusalem][u-ca=hebrew]`), nothing else.
 *
 * @param value candidate calendar zoned datetime string
 * @returns whether the whole string has the strict zoned shape and at most one `u-ca` annotation
 *
 * @example hasCalendarZonedShape("2024-02-24T14:30:00+02:00[Asia/Jerusalem][u-ca=hebrew]") // true
 * @example hasCalendarZonedShape("2024-02-24T14:30:00+02:00[Asia/Jerusalem]") // true
 * @example hasCalendarZonedShape("2024-02-24T14:30:00+02:00[Asia/Jerusalem][foo=bar]") // false
 */
export function hasCalendarZonedShape(value: string): boolean {
  return typeof value === "string" && calendarZonedDateTime.test(value);
}

/**
 * True when `value` is an extended ISO date or date-time with at most one calendar annotation
 * (`2024-10-03[u-ca=hebrew]`), nothing else: no time zone, no elective annotation.
 *
 * @param value candidate calendar date string
 * @returns whether the whole string has the strict shape
 *
 * @example hasCalendarDateShape("2024-10-03[u-ca=hebrew]") // true
 * @example hasCalendarDateShape("2024-10-03T14:30") // true
 * @example hasCalendarDateShape("2024-10-03[Europe/Helsinki]") // false
 * @example hasCalendarDateShape("2024-10-03[foo=bar]") // false
 */
export function hasCalendarDateShape(value: string): boolean {
  return typeof value === "string" && calendarDate.test(value);
}

/**
 * True when `value` is a string with GMT's strict extended instant shape over the whole string:
 * `<date>T<time>` then `Z` or an extended offset, and nothing after (see `instant`).
 *
 * @param value candidate instant string
 * @returns whether the whole string has the strict instant shape
 *
 * @example hasInstantShape("2024-10-03T18:30:00Z") // true
 * @example hasInstantShape("2024-10-03T14:30:00-04:00") // true
 * @example hasInstantShape("20241003T183000Z") // false
 * @example hasInstantShape("2024-10-03T18:30:00Z[Europe/Helsinki]") // false (zone annotation)
 * @example hasInstantShape("2024-10-03T18:30:00Z[foo=bar]") // false (any annotation)
 */
export function hasInstantShape(value: string): boolean {
  return typeof value === "string" && instant.test(value);
}

/**
 * The seconds field of the exact patterns (`:SS` with an optional fraction, optional as a whole),
 * and the same field written as a second of 60. Both are read from the patterns above, so a change
 * to the seconds grammar there reaches `second60` here; `second60Of` throws if the field is not
 * found, so the two cannot drift apart unnoticed.
 */
const SECONDS_FIELD = "(?::[0-5][0-9](?:[.,][0-9]{1,9})?)?";
const SECOND_60_FIELD = ":60(?:[.,][0-9]{1,9})?";

function second60Of(source: string): string {
  if (!source.includes(SECONDS_FIELD)) {
    throw new Error("the seconds field of the exact pattern changed");
  }
  return source.replace(SECONDS_FIELD, SECOND_60_FIELD);
}

/** `plainTime` and `<date>T<time>` with the seconds written as 60 (so required). */
const PLAIN_TIME_60 = second60Of(plainTime.source.slice(1, -1));
const DATE_TIME_60 = second60Of(EXTENDED_DATE_TIME);

/**
 * Every shape GMT has for a string with a second of 60 (it rejects all of them, as Temporal would
 * read the 60 as `:59`): a plain time, or a date-time that is plain, calendar-annotated, an
 * instant (`Z` or an offset, no annotation) or zoned (one zone bracket, the offset optional, then
 * at most one calendar annotation). Over the whole string; nothing else matches.
 */
const second60Shape: RegExp = new RegExp(
  `^(?:${PLAIN_TIME_60}` +
    `|${DATE_TIME_60}(?:${CALENDAR_ANNOTATION})?` +
    `|${DATE_TIME_60}(?:Z|${EXTENDED_UTC_OFFSET})` +
    `|${DATE_TIME_60}(?:Z|${EXTENDED_UTC_OFFSET})?${TIME_ZONE_ANNOTATION}(?:${CALENDAR_ANNOTATION})?)$`,
);

/**
 * True when `value` is exactly one of GMT's kind shapes with a seconds field of 60: the public
 * test behind `hasSecond60`. A spelling that is none of GMT's kinds (lower-case `t`, a space,
 * basic format, a time with an offset, a `[foo=bar]` annotation, trailing text) is false.
 *
 * @param value candidate string
 * @returns whether the whole string is a strict-shape value with a second of 60
 *
 * @example hasSecond60Shape("2016-12-31T23:59:60Z") // true
 * @example hasSecond60Shape("23:59:60") // true
 * @example hasSecond60Shape("2016-12-31t23:59:60Z") // false
 */
export function hasSecond60Shape(value: unknown): boolean {
  return typeof value === "string" && second60Shape.test(value);
}
