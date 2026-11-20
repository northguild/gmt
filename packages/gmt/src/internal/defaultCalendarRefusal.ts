/**
 * Locales whose default calendar GMT refuses on every host (compat D37). ECMA-402
 * CreateDateTimeFormat takes the calendar from the locale data when the caller names none, and
 * the hosts' data differ: Safari gives `en-SA` and `en-TH` the Islamic and Buddhist calendars and
 * `ar-SA` the Umm al-Qura one where others give Gregorian; Chromium has no data for `lrc`, `mzn`,
 * `ps` or `shn` and falls back to its default locale and calendar; Safari keeps language and
 * region aliases (UTS #35 Part 1 § 3.2.1) such as `pbu`, `prs` and `004` as written, so their data
 * is not the canonical locale's. GMT owns no calendar preference data, so a date formatter for
 * these tags with no calendar named returns its sentinel on every host. Naming a calendar (the
 * `-u-ca-` keyword or the `calendar` option) settles it.
 *
 * Measured over CLDR's languages and language aliases, alone and with each region (letter and
 * numeric codes) and script, on Node 22, 24 and 26, Chromium, Firefox, and Safari for macOS and
 * Linux. Keys are written as
 * in the caller's tag, with the language in lower case, the script in title case and the region
 * in upper case; variants and extensions do not change the default calendar.
 */

import { printsDateField } from "./printsDateField";
import { canonicalCalendar } from "./namedCalendar";
import { resolveLocale } from "./resolveLocale";

/** Languages whose default calendar some host gives differently, with any script or region. */
export const DISPUTED_CALENDAR_LANGUAGES: ReadonlySet<string> = new Set([
  "drw",
  "lrc",
  "mzn",
  "pbu",
  "per",
  "pes",
  "prs",
  "ps",
  "pus",
  "tnf",
]);

/**
 * Language and region pairs, written with no script, that every host gives the same default
 * calendar although the language alone is disputed.
 */
export const AGREED_CALENDAR_REGIONS: ReadonlySet<string> = new Set([
  "lrc-IQ",
  "pbu-586",
  "pbu-PK",
  "ps-PK",
  "pus-PK",
]);

/** Language and script pairs whose default calendar some host gives differently, with any region. */
export const DISPUTED_CALENDAR_SCRIPTS: ReadonlySet<string> = new Set([
  "uzn-Arab",
]);

/**
 * Language and region pairs, written with no script, whose default calendar some host gives
 * differently. With a script (`ar-Arab-SA`) every host agrees.
 */
export const DISPUTED_CALENDAR_REGIONS: ReadonlySet<string> = new Set([
  "ar-SA",
  "ara-SA",
  "ckb-364",
  "en-SA",
  "en-TH",
  "eng-SA",
  "eng-TH",
  "shn-764",
  "shn-TH",
  "uz-004",
  "uzn-004",
  "uzn-AF",
]);

/** The language, script and region subtags of a tag as written, normalized for case. */
function writtenSubtags(tag: string): {
  language: string;
  script: string | undefined;
  region: string | undefined;
} {
  const subtags = tag.split("-");
  const language = (subtags[0] ?? "").toLowerCase();
  let index = 1;
  let script: string | undefined;
  let region: string | undefined;
  const scriptSubtag = subtags[index] ?? "";
  if (/^[A-Za-z]{4}$/.test(scriptSubtag)) {
    script =
      scriptSubtag.charAt(0).toUpperCase() +
      scriptSubtag.slice(1).toLowerCase();
    index += 1;
  }
  const regionSubtag = subtags[index] ?? "";
  if (/^(?:[A-Za-z]{2}|\d{3})$/.test(regionSubtag)) {
    region = regionSubtag.toUpperCase();
  }
  return { language, script, region };
}

/**
 * Whether some host gives a tag a different default calendar (compat D37). The tag is read as
 * written: hosts canonicalize aliases differently, so the written form is the one every host
 * shows the same way.
 *
 * @param tag a locale tag as the caller wrote it
 * @returns `true` when the default calendar is disputed
 *
 * @example isDisputedCalendarTag("ar-SA") // true
 * @example isDisputedCalendarTag("ar-Arab-SA") // false
 * @example isDisputedCalendarTag("ps-PK") // false
 */
export function isDisputedCalendarTag(tag: string): boolean {
  const { language, script, region } = writtenSubtags(tag);
  if (DISPUTED_CALENDAR_LANGUAGES.has(language)) {
    return !(
      script === undefined &&
      region !== undefined &&
      AGREED_CALENDAR_REGIONS.has(`${language}-${region}`)
    );
  }
  if (script !== undefined) {
    return DISPUTED_CALENDAR_SCRIPTS.has(`${language}-${script}`);
  }
  return (
    region !== undefined &&
    DISPUTED_CALENDAR_REGIONS.has(`${language}-${region}`)
  );
}

/** At most this many remembered default calendars; past it the map clears. */
const MAX_DEFAULTS = 256;
const defaultCalendars = new Map<string, string>();
let defaultsBuiltWith: unknown;

/** The host's default calendar for one tag, remembered while `Intl.DateTimeFormat` is the same. */
function defaultCalendarOf(tag: string): string {
  if (defaultsBuiltWith !== Intl.DateTimeFormat) {
    defaultCalendars.clear();
    defaultsBuiltWith = Intl.DateTimeFormat;
  }
  let calendar = defaultCalendars.get(tag);
  if (calendar === undefined) {
    try {
      calendar = new Intl.DateTimeFormat(tag).resolvedOptions().calendar;
    } catch {
      // A tag the host cannot read never matches another one.
      calendar = `?${tag}`;
    }
    if (defaultCalendars.size >= MAX_DEFAULTS) {
      defaultCalendars.clear();
    }
    defaultCalendars.set(tag, calendar);
  }
  return calendar;
}

/**
 * Whether the default calendar of a locales argument is disputed: some tag is
 * (`isDisputedCalendarTag`), or the tags have different default calendars. Hosts have data for
 * different languages, so ECMA-402 LookupMatcher can pick a different tag of the list on each,
 * and with it a different calendar. An omitted locale or an empty list reads the host's default
 * locale.
 *
 * @param locales the tags as the caller wrote them
 * @returns `true` when the default calendar is disputed
 *
 * @example isDisputedCalendarLocale(["en", "ar-SA"]) // true
 * @example isDisputedCalendarLocale(["fur", "fa"]) // true: gregory and persian
 * @example isDisputedCalendarLocale(["en-GB", "en"]) // false
 */
export function isDisputedCalendarLocale(
  locales: string | readonly string[] | undefined,
): boolean {
  const tags =
    typeof locales === "string"
      ? [locales]
      : locales === undefined || locales.length === 0
        ? [resolveLocale(undefined) ?? ""]
        : locales;
  if (tags.some(isDisputedCalendarTag)) {
    return true;
  }
  const first = defaultCalendarOf(tags[0] ?? "");
  return tags.some((tag) => defaultCalendarOf(tag) !== first);
}

/**
 * Refuse a formatter that would print a date in a disputed default calendar (compat D37), on
 * every host and with no probe. Throws RangeError when the formatter prints a year, month, day
 * or era, its calendar is not the one the caller named, and the locale's default calendar is
 * disputed. A calendar the caller named and the host has is the caller's on every host; one the
 * host does not have falls back to the default, so it is refused as if none were named. A
 * time-only or weekday-only formatter is returned.
 *
 * @param formatter the formatter built from the caller's locale and options
 * @param locales the caller's tags as written
 * @param named the calendar the caller named (option or `-u-ca-` keyword), if any
 * @returns the same formatter, when it is not refused
 * @throws RangeError when it would print a date in a disputed default calendar
 *
 * @example refuseDisputedDefaultCalendar(new Intl.DateTimeFormat("en-TH"), "en-TH", undefined) // throws RangeError
 * @example refuseDisputedDefaultCalendar(new Intl.DateTimeFormat("en-TH", { calendar: "buddhist" }), "en-TH", "buddhist") // returns it
 * @example refuseDisputedDefaultCalendar(new Intl.DateTimeFormat("en-TH", { hour: "numeric" }), "en-TH", undefined) // returns it
 */
export function refuseDisputedDefaultCalendar(
  formatter: Intl.DateTimeFormat,
  locales: string | readonly string[] | undefined,
  named: string | undefined,
): Intl.DateTimeFormat {
  let resolved: Intl.ResolvedDateTimeFormatOptions;
  try {
    resolved = formatter.resolvedOptions();
  } catch {
    // A formatter that cannot report its options adds no new failure path.
    return formatter;
  }
  if (named !== undefined && resolved.calendar === canonicalCalendar(named)) {
    return formatter;
  }
  if (
    printsDateField(formatter, resolved) &&
    isDisputedCalendarLocale(locales)
  ) {
    throw new RangeError(
      "This locale's default calendar differs between hosts; name a calendar",
    );
  }
  return formatter;
}
