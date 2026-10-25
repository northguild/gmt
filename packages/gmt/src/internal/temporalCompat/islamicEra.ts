import { Temporal } from "../temporal";

/*
 * D18: which era the runtime's `Intl.DateTimeFormat` prints an Islamic date in.
 *
 * WebKit (JavaScriptCore) prints an `islamic-civil`, `islamic-tbla` or `islamic-umalqura` date
 * before the Hijra as a positive year in a second era (`Before Hijra`), where V8 and SpiderMonkey
 * print a negative year in the one era. Polyfill 0.5.1 reads the year part as printed and never
 * looks at the era part (`IslamicBaseHelper` has no era), so in WebKit its `year` for such a date
 * is `1 - year`. `calendarFields.ts` corrects the year when this file says the date's era is not the
 * era of a modern date. The comparison is between two outputs of the same formatter, so GMT owns
 * no era name and no epoch.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();
const modernEras = new Map<string, string | undefined>();

/** A date after the epoch of every calendar GMT supports: the era every modern date prints in. */
const MODERN_DATE_MS =
  Temporal.PlainDate.from("2000-01-01").toZonedDateTime(
    "UTC",
  ).epochMilliseconds;

function formatterFor(calendarId: string): Intl.DateTimeFormat {
  let format = formatters.get(calendarId);
  if (format === undefined) {
    // The options the polyfill reads its fields with, so the parts are the ones it saw.
    format = new Intl.DateTimeFormat(`en-u-ca-${calendarId}`, {
      era: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
    formatters.set(calendarId, format);
  }
  return format;
}

function eraPartAt(calendarId: string, ms: number): string | undefined {
  return formatterFor(calendarId)
    .formatToParts(ms)
    .find((part) => part.type === "era")?.value;
}

function modernEraOf(calendarId: string): string | undefined {
  if (!modernEras.has(calendarId)) {
    modernEras.set(calendarId, eraPartAt(calendarId, MODERN_DATE_MS));
  }
  return modernEras.get(calendarId);
}

/**
 * Midnight UTC of `date` as an epoch millisecond count, what `Intl.DateTimeFormat` formats.
 * `-271821-04-19`, the one PlainDate whose midnight precedes the first instant, is read as the
 * next day: both lie in the same era of every calendar.
 */
function timeValueOf(date: Temporal.PlainDate): number {
  const iso = date.withCalendar("iso8601");
  try {
    return iso.toZonedDateTime("UTC").epochMilliseconds;
  } catch {
    return iso.add({ days: 1 }).toZonedDateTime("UTC").epochMilliseconds;
  }
}

/**
 * True when the runtime prints `date` in the same era as a modern date of `calendarId`. False
 * only on a runtime that prints a second era for dates before the calendar's epoch (D18).
 */
export function printsInModernEra(
  date: Temporal.PlainDate,
  calendarId: string,
): boolean {
  return eraPartAt(calendarId, timeValueOf(date)) === modernEraOf(calendarId);
}
