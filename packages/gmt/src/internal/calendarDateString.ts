import { Temporal } from "@js-temporal/polyfill";
import { calendarDate } from "../regex";
import {
  calendarSystemIdFromTemporal,
  isCalendarSystem,
  temporalCalendarIds,
} from "./calendarSystemIds";

/**
 * Parse a plain ISO PlainDate string or a GMT calendar-annotated PlainDate string
 * (`"5785-01-01[u-ca=hebrew]"`, calendar-native fields, not Temporal's own ISO-digit
 * `[u-ca=...]` annotation convention) into a Temporal.PlainDate. Throws on invalid input —
 * callers wrap this in try-catch per GMT's sentinel-return contract.
 *
 * The regex only proves shape; `Temporal.PlainDate.from` performs the real construction
 * and validation (rejecting overflowed fields and unknown calendar identifiers), per the
 * scoped manual-string-parsing exception for fixed, non-caller-supplied grammars.
 */
export function parseCalendarDateValue(value: string): Temporal.PlainDate {
  const match = calendarDate.exec(value);
  if (!match) {
    return Temporal.PlainDate.from(value);
  }

  const [, year, month, day, calendarId, era] = match;
  // The regex captures GMT's own calendar identifier (e.g. "islamic-tabular"), which
  // doesn't always match Temporal's id for the same calendar (e.g. "islamic-tbla") — an
  // unrecognized id is passed through as-is so Temporal.PlainDate.from rejects it the
  // same way it rejects any other unknown calendar identifier.
  const temporalCalendarId = isCalendarSystem(calendarId)
    ? temporalCalendarIds[calendarId]
    : calendarId;
  // A captured `;era=` suffix (only ever present for "japanese", the one calendar whose
  // plain `.year` doesn't reset at an era change) means `year` is an era-relative
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
 * Format a Temporal.PlainDate as GMT's calendar-annotated string: a bare ISO string for
 * the "iso8601" calendar (GMT's existing default, unannotated), or the calendar's own
 * native year/month/day tagged with `[u-ca=<identifier>]` for any other calendar.
 *
 * "japanese" is the one exception to "native year": Temporal's `.year` for it stays
 * proleptic across era changes (Meiji 1 and Reiwa 1 don't both read `1`), which would
 * contradict the era-based numbering the calendar is for — so it's tagged with `.eraYear`
 * and `;era=<name>` instead, both of which Temporal always populates for this calendar
 * (including for pre-Meiji dates, under a synthetic "japanese" era — see the README's
 * calendar-systems section for why GMT doesn't reject those unlike `@internationalized/date`).
 */
export function formatCalendarDate(date: Temporal.PlainDate): string {
  if (date.calendarId === "iso8601") {
    return date.toString();
  }

  const calendarId = calendarSystemIdFromTemporal(date.calendarId);
  const isEraBased = calendarId === "japanese";
  const year = String(isEraBased ? date.eraYear : date.year).padStart(4, "0");
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  const eraSuffix = isEraBased ? `;era=${date.era}` : "";
  return `${year}-${month}-${day}[u-ca=${calendarId}${eraSuffix}]`;
}
