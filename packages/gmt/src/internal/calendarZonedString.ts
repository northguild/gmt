import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../plain/validate/isLeapSecond";
import { calendarZonedDateTime } from "../regex";
import type { CalendarSystem, Disambiguation, Offset } from "../types";
import { parseCalendarDateValue } from "./calendarDateString";
import { temporalCalendarIds } from "./calendarSystemIds";
import { isEthiopicFamilyCalendar } from "./ethiopicFamilyCalendar";
import { calendarDateStringParts } from "./formatDateInCalendar";
import { hasCalendarAnnotation } from "./hasCalendarAnnotation";

/**
 * Parse a bare ISO ZonedDateTime string or a GMT calendar-annotated ZonedDateTime string
 * (`"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"`, calendar-native fields, not
 * Temporal's own ISO-digit `[u-ca=...]` annotation convention) into a Temporal.ZonedDateTime.
 * Throws on invalid input — callers wrap this in try-catch per GMT's sentinel-return contract.
 *
 * The regex only proves shape; the real construction and validation happen in Temporal —
 * `parseCalendarDateValue` (`Temporal.PlainDate.from(fields, { overflow: "reject" })`) for the
 * calendar-native date half, and `Temporal.ZonedDateTime.from` for the recomposed ISO string
 * (which rejects unknown zones, stale offsets, and out-of-range times). See
 * `context/coding-standards.md`'s scoped manual-string-parsing exception, rule 2.
 *
 * ---------------------------------------------------------------------------------------
 * WHY THE DATE HALF IS FIELD-DECOMPOSED AND HANDED BACK TO TEMPORAL AS ISO DIGITS
 * ---------------------------------------------------------------------------------------
 * The `;era=` suffix can NEVER round-trip through Temporal, at any segment ordering, because it
 * is not valid RFC 9557 at all — `Temporal.PlainDate.from("0006-10-03[u-ca=japanese;era=reiwa]")`
 * throws `RangeError: invalid RFC 9557 string`, and so does every `Temporal.*.from` entry point
 * given the same suffix. Era-bearing calendars ("japanese", "ethiopic") therefore have to be
 * decomposed into `{ era, eraYear, month, day }` and constructed field-wise, which is exactly
 * what `parseCalendarDateValue` already does for the plain case — this function delegates the
 * whole date half to it rather than reimplementing era handling, the Ethiopic-family "ethioaa"
 * carrier routing, or the GMT-to-Temporal calendar-id mapping.
 *
 * The date half then travels back through Temporal as plain ISO digits
 * (`.withCalendar("iso8601").toString()`), so `Temporal.ZonedDateTime.from` resolves the zone,
 * offset and DST against a string it can actually parse. The calendar is re-attached to the
 * RESULT via `.withCalendar(...)`, which keeps downstream `.add`/`.until`/`.round` calendar-aware
 * (verified: `withTimeZone`/`round`/`with`/`startOfDay`/`toPlainDate` all preserve the tag).
 *
 * `isLeapSecond` runs before anything else, exactly as `isValidZonedDateTime` does: verified that
 * `Temporal.ZonedDateTime.from("2024-06-30T23:59:60+00:00[UTC]")` silently CLAMPS to `:59` rather
 * than throwing, so this guard is load-bearing rather than redundant.
 *
 * @param value bare ISO zoned datetime string, or GMT calendar-annotated zoned datetime string
 * @param options optional Temporal `disambiguation`/`offset`, passed through to
 *   `Temporal.ZonedDateTime.from` so a caller's own DST/offset policy still applies
 * @returns Temporal.ZonedDateTime carrying the annotated calendar (or `iso8601` when bare)
 */
export function parseCalendarZonedValue(
  value: string,
  options?: { disambiguation?: Disambiguation; offset?: Offset },
): Temporal.ZonedDateTime {
  if (isLeapSecond(value)) {
    throw new RangeError(`Leap seconds are not supported: ${value}`);
  }

  const match = calendarZonedDateTime.exec(value);
  if (!match) {
    // Either Temporal's own `[timeZone][u-ca=...]` ordering or a wrong-ordered GMT string. Both
    // are rejected rather than re-parsed: the former is not GMT's contract (E5 decision D1), and
    // the latter is the ~3760-year silent-misparse hazard documented in
    // `regex/calendar-zoned-date-time.ts`. Only a genuinely un-annotated string falls through.
    if (hasCalendarAnnotation(value)) {
      throw new RangeError(`Not a valid GMT ZonedDateTime string: ${value}`);
    }
    const bare = Temporal.ZonedDateTime.from(value, options);
    if (bare.timeZoneId.length === 0) {
      throw new RangeError(`Missing time zone: ${value}`);
    }
    return bare;
  }

  const [, year, month, day, time, offset, calendarId, era, timeZone] = match;
  const eraSuffix = era ? `;era=${era}` : "";
  const date = parseCalendarDateValue(
    `${year}-${month}-${day}[u-ca=${calendarId}${eraSuffix}]`,
  );

  const isoDate = date.withCalendar("iso8601").toString();
  const zoned = Temporal.ZonedDateTime.from(
    `${isoDate}T${time}${offset ?? ""}[${timeZone}]`,
    options,
  );

  // Re-attach the calendar the date half resolved to — `date.calendarId` rather than the string's
  // own tag, so the Ethiopic family lands on its "ethioaa" carrier and GMT ids that differ from
  // Temporal's ("islamic-tabular" -> "islamic-tbla") map through exactly once, in one place.
  return zoned.withCalendar(date.calendarId);
}

/**
 * Format a Temporal.ZonedDateTime as GMT's calendar-annotated (or bare ISO) zoned string in a
 * known target CalendarSystem — the zoned companion to `formatDateInCalendar`, and the ONLY
 * writer of the calendar-annotated zoned grammar anywhere in GMT.
 *
 * Never call `zdt.toString()` on a calendared value and never compose
 * `` `${zdt.toPlainDateTime()}[${zdt.timeZoneId}]` `` on one either: both emit Temporal's
 * `[timeZone][u-ca=...]` RFC 9557 ordering (verified: a Hebrew-calendared
 * `.toPlainDateTime().toString()` yields `"2024-03-25T14:30:00[u-ca=hebrew]"`), which is exactly
 * the ordering GMT rejects because reading it back misparses the digits as ISO. Route every
 * calendar-annotated zoned output through this function instead.
 *
 * Every field is RE-DERIVED from the actual `zdt` result and nothing but the IANA zone id is
 * copied (E7's D7-zoned, extending E5's D7): a single calendar-unit add can move the era AND the
 * UTC offset at once — verified, Japanese Heisei 31-04-05 in `Africa/Casablanca` `+1 month` lands
 * on Reiwa 1-05-05 inside a DST fold — so a tag or offset copied from the input would describe a
 * moment that no longer exists.
 *
 * Unlike `formatDateInCalendar`, this does NOT require `zdt` to already carry `calendar`'s own
 * Temporal calendar id — it re-calendars the value itself before reading the date fields. That is
 * deliberate: several `zoned/interval/*` functions synthesize boundary points via
 * `Temporal.Instant.prototype.toZonedDateTimeISO`, which always returns an `iso8601`-calendared
 * value. Re-calendaring here means a synthesized boundary can never silently emit a bare ISO
 * string into an otherwise calendar-tagged result set — one class of bug removed by construction
 * rather than by remembering to re-attach the tag at every synthesis site. The instant, wall time
 * and zone are untouched; only which calendar the date fields resolve through changes.
 *
 * @param zdt Temporal.ZonedDateTime to format
 * @param calendar the CalendarSystem to express `zdt`'s date fields in
 * @returns GMT's calendar-annotated (or bare ISO, for "gregorian") zoned datetime string
 */
export function formatZonedInCalendar(
  zdt: Temporal.ZonedDateTime,
  calendar: CalendarSystem,
): string {
  if (calendar === "gregorian") {
    return zdt.withCalendar("iso8601").toString();
  }

  // The whole Ethiopic family computes through "ethioaa" rather than Temporal's own
  // "ethiopic"/"coptic" ids, which throw under ICU >= 78 — see internal/ethiopicFamilyCalendar.ts.
  const temporalCalendarId = isEthiopicFamilyCalendar(calendar)
    ? "ethioaa"
    : temporalCalendarIds[calendar];

  const { date, annotation } = calendarDateStringParts(
    zdt.withCalendar(temporalCalendarId).toPlainDate(),
    calendar,
  );
  const time = zdt.toPlainTime().toString();
  return `${date}T${time}${zdt.offset}${annotation}[${zdt.timeZoneId}]`;
}
