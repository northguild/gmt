/**
 * The calendar the caller named for a date formatter, passed as the `calendar` option.
 *
 * ECMA-402 ResolveLocale keeps a `-u-ca-` keyword only when the locale it resolves to is the
 * caller's tag; LookupMatcher falls back to the host's default locale, without the keyword, when
 * the host has no data for the language. Hosts ship data for different languages (Chromium has
 * none for `fur`, `gl` or `my`), so `fur-u-ca-hebrew` printed a Hebrew year on one host and a
 * Gregorian one on another. The `calendar` option applies to whatever locale is resolved
 * (CreateDateTimeFormat), so passing the keyword as the option gives the caller's calendar on
 * every host. An option equal to the keyword leaves the resolved locale as it was.
 */

/** The formatter locales argument: a tag, a list of tags, or the host default. */
type Locales = string | readonly string[] | undefined;

/**
 * The `-u-ca-` keyword every tag of the argument carries, as `Intl.Locale` reads it, or
 * `undefined` when some tag carries none, the tags name different calendars, or a tag cannot be
 * read (the constructor rejects it later).
 *
 * @param locales the tags as the caller wrote them
 * @returns the calendar keyword shared by every tag
 *
 * @example sharedCalendarKeyword("gl-u-ca-hebrew") // "hebrew"
 * @example sharedCalendarKeyword(["fur-u-ca-hebrew", "en-u-ca-hebrew"]) // "hebrew"
 * @example sharedCalendarKeyword(["fur-u-ca-hebrew", "en"]) // undefined
 */
export function sharedCalendarKeyword(locales: Locales): string | undefined {
  const tags = typeof locales === "string" ? [locales] : (locales ?? []);
  // Most tags carry no Unicode extension: no `Intl.Locale` is built for them.
  if (tags.length === 0 || !tags.every((tag) => /-u-/i.test(tag))) {
    return undefined;
  }
  let shared: string | undefined;
  for (const tag of tags) {
    let calendar: string | undefined;
    try {
      calendar = new Intl.Locale(tag).calendar;
    } catch {
      return undefined;
    }
    if (
      calendar === undefined ||
      (shared !== undefined && calendar !== shared)
    ) {
      return undefined;
    }
    shared = calendar;
  }
  return shared;
}

/**
 * The options with the caller's `-u-ca-` keyword passed as the `calendar` option, when every tag
 * names the same calendar and the options name none. Options that already name a calendar win,
 * as in ECMA-402 ResolveLocale.
 *
 * @param locales the tags as the caller wrote them
 * @param options the formatter's options
 * @returns the options to build with
 *
 * @example withNamedCalendar("fur-u-ca-hebrew", { year: "numeric" }) // { year: "numeric", calendar: "hebrew" }
 * @example withNamedCalendar("fur-u-ca-hebrew", { calendar: "gregory" }) // { calendar: "gregory" }
 * @example withNamedCalendar("en", { year: "numeric" }) // the same options
 */
export function withNamedCalendar(
  locales: Locales,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions {
  if (options.calendar !== undefined) {
    return options;
  }
  const calendar = sharedCalendarKeyword(locales);
  return calendar === undefined ? options : { ...options, calendar };
}

/**
 * A calendar name as `Intl` canonicalizes it (UTS #35 Part 1 § 3.2.1 `calendar` aliases:
 * `islamicc` is `islamic-civil`, `ethiopic-amete-alem` is `ethioaa`), or the name as given when
 * `Intl.Locale` cannot read it.
 *
 * @param calendar a calendar name
 * @returns the canonical name
 *
 * @example canonicalCalendar("islamicc") // "islamic-civil"
 * @example canonicalCalendar("gregory") // "gregory"
 */
export function canonicalCalendar(calendar: string): string {
  try {
    return new Intl.Locale("und", { calendar }).calendar ?? calendar;
  } catch {
    return calendar;
  }
}
