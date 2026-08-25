import { Temporal } from "@js-temporal/polyfill";
import { calendarDate, plainDate } from "../regex";
import {
  calendarSystemIdFromTemporal,
  isCalendarSystem,
  temporalCalendarIds,
} from "./calendarSystemIds";
import {
  dateFromEthiopicFamilyFields,
  isEthiopicFamilyCalendar,
} from "./ethiopicFamilyCalendar";

/**
 * Parse a plain ISO PlainDate string or a GMT calendar-annotated PlainDate string
 * (`"5785-01-01[u-ca=hebrew]"`, calendar-native fields, not Temporal's own ISO-digit
 * `[u-ca=...]` annotation convention) into a Temporal.PlainDate. Throws on invalid input —
 * callers wrap this in try-catch per GMT's sentinel-return contract.
 *
 * The regex only proves shape; `Temporal.PlainDate.from` performs the real construction
 * and validation (rejecting overflowed fields and unknown calendar identifiers), per the
 * scoped manual-string-parsing exception for fixed, non-caller-supplied grammars. The
 * Ethiopic family ("ethiopic" / "ethiopic-amete-alem" / "coptic") is the one exception —
 * see ethiopicFamilyCalendar.ts for why they're constructed via GMT-owned arithmetic
 * instead of Temporal's own calendar ids for those three.
 *
 * The non-annotated fallback branch requires the strict PlainDate-only shape (via the
 * `plainDate` regex) before delegating to `Temporal.PlainDate.from` — bare `.from()` silently
 * truncates a full datetime/zoned string to its date portion (`Temporal.PlainDate.from("2024-
 * 03-10T14:30:00")` succeeds), which would make this function (and therefore
 * `isValidCalendarDate`/`convertDateToCalendar`) wrongly accept datetime input. Found and
 * fixed as part of E5 (issue #78) — it predates this story but this function is E5's shared
 * gate, so it must not inherit the hazard.
 */
export function parseCalendarDateValue(value: string): Temporal.PlainDate {
  const match = calendarDate.exec(value);
  if (!match) {
    if (!plainDate.test(value)) {
      throw new RangeError(`Not a valid GMT PlainDate string: ${value}`);
    }
    return Temporal.PlainDate.from(value);
  }

  const [, year, month, day, calendarId, era] = match;
  if (isEthiopicFamilyCalendar(calendarId)) {
    return dateFromEthiopicFamilyFields(calendarId, {
      year: era ? undefined : Number(year),
      era,
      eraYear: era ? Number(year) : undefined,
      month: Number(month),
      day: Number(day),
    });
  }

  // The regex captures GMT's own calendar identifier (e.g. "islamic-tabular"), which
  // doesn't always match Temporal's id for the same calendar (e.g. "islamic-tbla") — an
  // unrecognized id is passed through as-is so Temporal.PlainDate.from rejects it the
  // same way it rejects any other unknown calendar identifier.
  const temporalCalendarId = isCalendarSystem(calendarId)
    ? temporalCalendarIds[calendarId]
    : calendarId;
  // A captured `;era=` suffix (only ever present for "japanese", the one remaining calendar
  // whose plain `.year` doesn't reset at an era change) means `year` is an era-relative
  // `eraYear`, not a proleptic year — Temporal needs `era`+`eraYear` together to resolve
  // it back to the correct date.
  const fields = era
    ? { era, eraYear: Number(year), month: Number(month), day: Number(day) }
    : { year: Number(year), month: Number(month), day: Number(day) };
  return Temporal.PlainDate.from(
    { ...fields, calendar: temporalCalendarId },
    { overflow: "reject" },
  );
}

/**
 * The two halves of GMT's calendar-annotated PlainDate string, kept separate so a zoned string
 * can splice its own time/offset between them: `<date>` is the calendar-native (or bare ISO)
 * `YYYY-MM-DD`, `<annotation>` is the `[u-ca=...]` tail (empty for the "iso8601" calendar).
 *
 * `formatCalendarDate` is `date + annotation`; `internal/calendarZonedString.ts`'s
 * `formatZonedInCalendar` is `date + "T" + time + offset + annotation + "[" + timeZone + "]"`,
 * since GMT's zoned grammar orders `[u-ca=...]` before `[timeZone]` (see
 * `regex/calendar-zoned-date-time.ts` for why). Splitting here rather than string-slicing
 * `formatCalendarDate`'s output on `"["` keeps the era/zero-padding logic in exactly one place.
 */
export interface CalendarDateStringParts {
  date: string;
  annotation: string;
}

/**
 * Split a Temporal.PlainDate into GMT's calendar-annotated string halves: a bare ISO date with
 * an empty annotation for the "iso8601" calendar (GMT's existing default, unannotated), or the
 * calendar's own native year/month/day plus a `[u-ca=<identifier>]` annotation for any other.
 *
 * "japanese" is the one exception to "native year": Temporal's `.year` for it stays
 * proleptic across era changes (Meiji 1 and Reiwa 1 don't both read `1`), which would
 * contradict the era-based numbering the calendar is for — so it's tagged with `.eraYear`
 * and `;era=<name>` instead, both of which Temporal always populates for this calendar
 * (including for pre-Meiji dates, under a synthetic "japanese" era — see the README's
 * calendar-systems section for why GMT doesn't reject those unlike `@internationalized/date`).
 *
 * This function is never called with an Ethiopic-family ("ethiopic" /
 * "ethiopic-amete-alem" / "coptic") calendared date — those three format through
 * `ethiopicFamilyDateParts` in ethiopicFamilyCalendar.ts instead, which never touches
 * Temporal's own "ethiopic"/"coptic" calendar ids. See that file for why.
 */
export function calendarDateParts(
  date: Temporal.PlainDate,
): CalendarDateStringParts {
  if (date.calendarId === "iso8601") {
    return { date: date.toString(), annotation: "" };
  }

  const calendarId = calendarSystemIdFromTemporal(date.calendarId);
  const isEraBased = calendarId === "japanese";
  const year = String(isEraBased ? date.eraYear : date.year).padStart(4, "0");
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  const eraSuffix = isEraBased ? `;era=${date.era}` : "";
  return {
    date: `${year}-${month}-${day}`,
    annotation: `[u-ca=${calendarId}${eraSuffix}]`,
  };
}

/**
 * Format a Temporal.PlainDate as GMT's calendar-annotated string: a bare ISO string for
 * the "iso8601" calendar (GMT's existing default, unannotated), or the calendar's own
 * native year/month/day tagged with `[u-ca=<identifier>]` for any other calendar.
 *
 * See `calendarDateParts` (the shared primitive this concatenates) for the era handling and
 * the Ethiopic-family carve-out.
 */
export function formatCalendarDate(date: Temporal.PlainDate): string {
  const { date: datePart, annotation } = calendarDateParts(date);
  return `${datePart}${annotation}`;
}
