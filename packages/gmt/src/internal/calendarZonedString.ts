import type { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../plain/validate/isLeapSecond";
import type { CalendarSystem, Disambiguation, Offset } from "../types";
import {
  canonicalCalendarSystem,
  computationCalendarId,
} from "./calendarSystemIds";
import { hasZonedDateTimeShape } from "./isoStringBody";
import { zonedDateTimeFrom } from "./zonedWallClock";

/**
 * Parse a GMT ZonedDateTime string into a Temporal.ZonedDateTime, read exactly as
 * `Temporal.ZonedDateTime.from` reads it (`"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"`,
 * which is what `Temporal.ZonedDateTime#toString()` writes). Throws on invalid input — callers wrap
 * this in try-catch per GMT's sentinel contract.
 *
 * - The part before the first `[` must be GMT's strict ISO 8601 extended shape
 *   (`zonedDateTimeBody`: `<date>T<time>`, then nothing, `Z` or `±HH:MM[:SS[.fraction]]`), as
 *   `isValidZonedDateTime` requires. Basic format, a space or lower-case `t`
 *   separator, a lower-case `z`, an hour-only time or offset and a date without a time throw,
 *   although `Temporal.ZonedDateTime.from` reads them.
 * - The digits are ISO. The whole string goes to `zonedDateTimeFrom` (`Temporal.ZonedDateTime.from`,
 *   correct at the range limits), which validates the date, time, offset, zone and annotations.
 * - The annotations follow Temporal's ISO grammar (`ParseISODateTime`): the time zone annotation
 *   comes first, elective unknown annotations (`[foo=bar]`) are ignored, the first `u-ca`
 *   annotation names the calendar, and an unknown critical annotation or a second `u-ca`
 *   annotation when either one is critical is rejected. A calendar before the zone and `;era=`
 *   are not RFC 9557 and Temporal rejects them.
 * - The calendar id is Temporal's canonical one (`CanonicalizeCalendar`) and must be a
 *   `CalendarSystem`.
 * - The result computes in `computationCalendarId(calendar)` (`"ethioaa"` for `"ethiopic"` and
 *   `"coptic"`), so callers that write a string back take the calendar from
 *   `calendarSystemOfZonedValue(value)`.
 * - `isLeapSecond` runs first: `Temporal.ZonedDateTime.from("2024-06-30T23:59:60+00:00[UTC]")`
 *   clamps to `:59` instead of throwing.
 *
 * @param value ISO zoned datetime string, optionally with RFC 9557 annotations after the zone
 * @param options optional Temporal `disambiguation`/`offset`, passed through to
 *   `Temporal.ZonedDateTime.from` so a caller's own DST/offset policy still applies
 * @returns Temporal.ZonedDateTime in the computation calendar (`iso8601` when unannotated)
 */
export function parseCalendarZonedValue(
  value: string,
  options?: { disambiguation?: Disambiguation; offset?: Offset },
): Temporal.ZonedDateTime {
  if (isLeapSecond(value)) {
    throw new RangeError(`Leap seconds are not supported: ${value}`);
  }
  if (!hasZonedDateTimeShape(value)) {
    throw new RangeError(
      `Not an extended ISO 8601 zoned date-time: ${String(value)}`,
    );
  }

  const zoned = zonedDateTimeFrom(value, options);
  if (zoned.timeZoneId.length === 0) {
    throw new RangeError(`Missing time zone: ${value}`);
  }
  const calendar = canonicalCalendarSystem(zoned.calendarId);
  if (!calendar) {
    throw new RangeError(`Unsupported calendar: ${zoned.calendarId}`);
  }
  return zoned.withCalendar(computationCalendarId(calendar));
}

/**
 * Write a Temporal.ZonedDateTime as a GMT ZonedDateTime string in `calendar`: exactly
 * `Temporal.ZonedDateTime#toString()` for that instant, zone and calendar — the ISO date and time,
 * the offset, `[<timeZone>]`, then `[u-ca=<id>]` for every calendar but `"iso8601"`
 * (`FormatCalendarAnnotation` with `"auto"`).
 *
 * The calendar is passed in rather than read from `zdt.calendarId`: `"ethiopic"` and `"coptic"`
 * compute in `"ethioaa"`, and boundary points synthesized with
 * `Temporal.Instant.prototype.toZonedDateTimeISO` are `iso8601`. The instant, wall time and zone
 * are written as they are; only the annotation names the calendar.
 *
 * @param zdt Temporal.ZonedDateTime to write, in any calendar
 * @param calendar the CalendarSystem the string names
 * @returns the RFC 9557 zoned datetime string
 */
export function formatZonedInCalendar(
  zdt: Temporal.ZonedDateTime,
  calendar: CalendarSystem,
): string {
  const iso = zdt.withCalendar("iso8601").toString();
  return calendar === "iso8601" ? iso : `${iso}[u-ca=${calendar}]`;
}
