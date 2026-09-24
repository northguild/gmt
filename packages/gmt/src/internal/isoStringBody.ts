import { plainDateTime } from "../regex/date-time";

/**
 * The part of a Temporal ISO 8601 string before its first RFC 9557 annotation: everything before
 * the first `[`, or the whole string when it has none.
 *
 * GMT's validators check this part against GMT's strict ISO 8601 extended shape (`plainDate`,
 * `plainDateTime`, `plainTime`, `utcDateTime`, and `zonedDateTimeBody` / `instantBody` below) and hand the whole string to `Temporal.X.from`, which applies Temporal's
 * annotation grammar (proposal-temporal `ParseISODateTime`; RFC 9557 §3.3): elective unknown
 * annotations and a time zone annotation on a plain value are read and ignored, the first `u-ca`
 * annotation names the calendar, and an unknown critical annotation is rejected. The same split
 * as `internal/calendarDateString.ts`.
 *
 * @param value candidate ISO 8601 string
 * @returns the string up to its first annotation, or `""` for a non-string
 *
 * @example isoStringBody("2024-03-10[u-ca=iso8601]") // "2024-03-10"
 * @example isoStringBody("2024-03-10T12:30Z[foo=bar]") // "2024-03-10T12:30Z"
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
 * `[Europe/London]`, `[!+01:00]`; never `[u-ca=hebrew]` or `[!foo=bar]`. Every `key=value`
 * bracket is a tagged annotation, which Temporal reads (or rejects) on its own.
 *
 * A regular-expression source with no anchors and no capture groups, so callers can embed or
 * anchor it: GMT's one statement of "this bracket names a time zone".
 *
 * @example new RegExp(TIME_ZONE_ANNOTATION).test("2024-06-15T10:00:00Z[!Europe/London]") // true
 * @example new RegExp(TIME_ZONE_ANNOTATION).test("2024-06-15T10:00:00Z[u-ca=gregory]") // false
 */
export const TIME_ZONE_ANNOTATION = "\\[!?[^\\]=]+\\]";

/** `plainDateTime` without its anchors: `<date>T<time>` with an optional fraction. */
const EXTENDED_DATE_TIME = plainDateTime.source.slice(1, -1);

/**
 * The part of a zoned datetime string before its first annotation (`isoStringBody`), in GMT's
 * strict ISO 8601 extended shape: `<date>T<time>` exactly as `plainDateTime` matches it, then
 * nothing, an upper-case `Z`, or an extended offset (`±HH:MM[:SS[.fraction]]`). GMT's strict-shape rule
 * applied to zoned strings. `Temporal.ZonedDateTime.from` reads more — basic format, a space or
 * lower-case `t` separator, a lower-case `z`, an hour-only time or offset, a date with no time —
 * and GMT rejects all of it before Temporal reads the annotations.
 *
 * @example zonedDateTimeBody.test("2024-10-03T14:30:00-04:00") // true
 * @example zonedDateTimeBody.test("2024-10-03T14:30:00") // true (the zone annotation resolves the offset)
 * @example zonedDateTimeBody.test("20241003T143000-0400") // false (basic format)
 * @example zonedDateTimeBody.test("2024-10-03") // false (no time)
 */
const zonedDateTimeBody: RegExp = new RegExp(
  `^${EXTENDED_DATE_TIME}(?:Z|${EXTENDED_UTC_OFFSET})?$`,
);

/**
 * An instant string before its first annotation, in GMT's strict ISO 8601 extended shape: the
 * `zonedDateTimeBody` shape with the `Z` or offset required (an instant has no zone to resolve a
 * wall clock). `Temporal.Instant.from` also reads basic format, `t`/space separators, `z` and
 * hour-only offsets; GMT rejects them.
 *
 * @example instantBody.test("2024-10-03T18:30:00Z") // true
 * @example instantBody.test("2024-10-03T14:30:00-04:00") // true
 * @example instantBody.test("2024-10-03T18:30:00z") // false (lower-case z)
 * @example instantBody.test("2024-10-03T14:30:00") // false (no designator)
 */
const instantBody: RegExp = new RegExp(
  `^${EXTENDED_DATE_TIME}(?:Z|${EXTENDED_UTC_OFFSET})$`,
);

/**
 * True when `value` is a string whose part before the first annotation is `zonedDateTimeBody`.
 * The shape gate every GMT zoned string input passes before `Temporal.ZonedDateTime.from`.
 *
 * @param value candidate zoned datetime string
 * @returns whether the unannotated part has GMT's strict extended zoned shape
 *
 * @example hasZonedDateTimeShape("2024-10-03T14:30:00-04:00[America/New_York]") // true
 * @example hasZonedDateTimeShape("2024-10-03 14:30:00-04:00[America/New_York]") // false
 */
export function hasZonedDateTimeShape(value: string): boolean {
  return (
    typeof value === "string" && zonedDateTimeBody.test(isoStringBody(value))
  );
}

/**
 * True when `value` is a string whose part before the first annotation is `instantBody`.
 *
 * @param value candidate instant string
 * @returns whether the unannotated part has GMT's strict extended instant shape
 *
 * @example hasInstantShape("2024-10-03T18:30:00Z[foo=bar]") // true
 * @example hasInstantShape("20241003T183000Z") // false
 */
export function hasInstantShape(value: string): boolean {
  return typeof value === "string" && instantBody.test(isoStringBody(value));
}
