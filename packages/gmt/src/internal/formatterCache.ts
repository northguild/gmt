import { plainOptionEntries } from "./plainOptionEntries";
import { writtenLocaleTags } from "./resolveLocale";
import { isIslamicCalendarResolutionCompatNeeded } from "./temporalCompat/capabilities";
import { forgetWeekYearVerdicts, guardDateTimeFormat } from "./weekYearGuard";
import { repairCopticEra } from "./copticEra";
import { repairIslamicEpochEra } from "./islamicEpochEra";
import { refuseLunisolarDate } from "./lunisolarRefusal";
import { refuseDisputedDefaultCalendar } from "./defaultCalendarRefusal";
import { withNamedCalendar } from "./namedCalendar";
import { isRefusedZoneName } from "./refusedZoneNames";
import { repairEraYearNumerals } from "./japaneseNumerals";
import { repairYearPrinting, widenRelatedYear } from "./yearPrinting";

/** The `Intl` formatter classes this module builds. */
type FormatterKind =
  | "DateTimeFormat"
  | "NumberFormat"
  | "ListFormat"
  | "RelativeTimeFormat";

type FormatterLocale = string | string[] | undefined;

/** At most this many formatters (or checked argument sets) per kind; past it the kind's map clears. */
const MAX_ENTRIES_PER_KIND = 256;

const formatters = new Map<FormatterKind, Map<string, object>>();
const checked = new Map<FormatterKind, Set<string>>();
/** The `Intl[kind]` constructor each kind's entries were built with. */
const builtWith = new Map<FormatterKind, unknown>();

/**
 * Forget a kind's formatters and checked argument sets when `Intl[kind]` is no longer the
 * constructor they were built with (a polyfill loaded later, a test stub), so every answer comes
 * from the constructor installed now.
 */
function forgetIfReplaced(kind: FormatterKind): void {
  const current: unknown = Intl[kind];
  if (builtWith.get(kind) !== current) {
    formatters.delete(kind);
    checked.delete(kind);
    builtWith.set(kind, current);
  }
}

/** The options to build with: widened (D28) when the formatter's calendar is chinese or dangi. */
function widened(
  native: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions {
  try {
    return widenRelatedYear(options, native.resolvedOptions().calendar);
  } catch {
    return options;
  }
}

/**
 * A date formatter with the week-year guard (D23, D24) and no year repair (D25 to D27, but for the era-year numerals under the guard): its parts
 * are the engine's own, as a caller that reads the engine's era needs them (D18, `islamicEra.ts`).
 * Not cached; the caller keeps it.
 *
 * @param locale BCP 47 locale
 * @param options the formatter's options, built by GMT code
 * @returns the guarded formatter
 *
 * @example guardedDateTimeFormat("en-u-ca-islamic-civil", { era: "short", timeZone: "UTC" }).formatToParts(0) // the engine's parts
 */
export function guardedDateTimeFormat(
  locale: FormatterLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const native = new Intl.DateTimeFormat(locale, options);
  // CORE-112 D28: a chinese or dangi `year: "2-digit"` is built as `"numeric"` where the engine
  // pads the related year.
  const built = options.year === "2-digit" ? widened(native, options) : options;
  // CORE-112 D27: a `ja` japanese era year is written in the numbering system under the guard, so
  // the guard reads the same digits in every field.
  return guardDateTimeFormat(
    repairEraYearNumerals(
      built === options ? native : new Intl.DateTimeFormat(locale, built),
      built,
    ),
    built,
  );
}

/**
 * The locale tag as D30 needs it: a `ca` keyword of `islamic` becomes `islamic-tbla`, and one of
 * `islamic-rgsa` is taken out (with its `-u` when it was the last keyword). Other keywords stay.
 */
function islamicTag(tag: string): string {
  // Most tags name no islamic calendar: no `Intl.Locale` is built for them.
  if (!/islamic/i.test(tag)) {
    return tag;
  }
  try {
    const { calendar } = new Intl.Locale(tag);
    if (calendar === "islamic") {
      return new Intl.Locale(tag, { calendar: "islamic-tbla" }).toString();
    }
    if (calendar === "islamic-rgsa") {
      return tag
        .replace(/-ca-islamic-rgsa(?![\da-z])/i, "")
        .replace(/-u(?=$|-[\da-wyz]-|-x-)/i, "");
    }
  } catch {
    // A tag `Intl.Locale` cannot read is left for the constructor to reject.
  }
  return tag;
}

/**
 * The locales and options a date formatter is built with, after D30: `islamic` becomes
 * `islamic-tbla` and `islamic-rgsa` is dropped, where the engine resolves either one (Intl
 * era/monthCode CreateDateTimeFormat; tc39/proposal-intl-era-monthcode#99).
 */
function islamicResolved(
  locale: FormatterLocale,
  options: Intl.DateTimeFormatOptions,
): [FormatterLocale, Intl.DateTimeFormatOptions] {
  if (!isIslamicCalendarResolutionCompatNeeded()) {
    return [locale, options];
  }
  let nextOptions = options;
  if (options.calendar === "islamic") {
    nextOptions = { ...options, calendar: "islamic-tbla" };
  } else if (options.calendar === "islamic-rgsa") {
    nextOptions = { ...options };
    delete nextOptions.calendar;
  }
  const rebuilt = Array.isArray(locale)
    ? locale.map(islamicTag)
    : typeof locale === "string"
      ? islamicTag(locale)
      : locale;
  return [rebuilt, nextOptions];
}

/**
 * @param locale the caller's tags as written (`canonicalLocale`)
 * @param refuseDates whether a chinese or dangi date formatter (compat D33), or one in a disputed
 * default calendar (compat D37), throws. The argument check passes `false`: it builds from the
 * caller's own options, which a time-only function completes later (`formatTime`), so only the
 * formatter a function formats with is refused.
 */
function construct(
  kind: FormatterKind,
  locale: FormatterLocale,
  options: object,
  refuseDates = true,
): object {
  switch (kind) {
    case "DateTimeFormat": {
      // D35: nine zone names hosts disagree on are refused before anything is built.
      const { timeZone } = options as Intl.DateTimeFormatOptions;
      if (typeof timeZone === "string" && isRefusedZoneName(timeZone)) {
        throw new RangeError(`time zone ${timeZone} is not supported`);
      }
      // The caller's `-u-ca-` keyword is passed as the `calendar` option, so a host without data
      // for the language keeps it (`namedCalendar.ts`).
      const [built, builtOptions] = islamicResolved(
        locale,
        withNamedCalendar(locale, options as Intl.DateTimeFormatOptions),
      );
      // D33: a chinese or dangi date is refused before any repair runs; D37: so is a date in a
      // default calendar hosts disagree on, read from the tags as the caller wrote them.
      const guarded = guardedDateTimeFormat(built, builtOptions);
      if (refuseDates) {
        refuseLunisolarDate(guarded);
        refuseDisputedDefaultCalendar(
          guarded,
          locale,
          typeof builtOptions.calendar === "string"
            ? builtOptions.calendar
            : undefined,
        );
      }
      return repairIslamicEpochEra(
        repairCopticEra(
          repairYearPrinting(guarded, builtOptions, (twin) =>
            cachedFormatter("DateTimeFormat", built, twin),
          ),
          builtOptions,
        ),
        builtOptions,
      );
    }
    case "NumberFormat":
      return new Intl.NumberFormat(locale, options as Intl.NumberFormatOptions);
    case "ListFormat":
      return new Intl.ListFormat(locale, options as Intl.ListFormatOptions);
    case "RelativeTimeFormat":
      return new Intl.RelativeTimeFormat(
        locale,
        options as Intl.RelativeTimeFormatOptions,
      );
  }
}

/**
 * Whether a canonical locale list can be part of a cache key: a string, or a non-empty array.
 * `undefined` and `[]` answer from the process default locale, which can change.
 */
function isCacheableLocale(locale: FormatterLocale): boolean {
  return (
    typeof locale === "string" || (Array.isArray(locale) && locale.length > 0)
  );
}

/** Whether these entries carry a `timeZone` string. */
function hasZoneString(entries: [string, unknown][]): boolean {
  return entries.some(
    ([name, value]) => name === "timeZone" && typeof value === "string",
  );
}

/**
 * The cache key for these arguments, or `null` when they must be constructed fresh. The
 * locale is already read (see `canonicalLocale`).
 *
 * @param zoneRequired whether the options must carry a `timeZone` string: a `DateTimeFormat`
 * without one answers from the process default zone, which can change.
 */
function cacheKey(
  kind: FormatterKind,
  locale: FormatterLocale,
  options: object,
  zoneRequired: boolean,
): string | null {
  if (!isCacheableLocale(locale)) {
    return null;
  }
  const entries = plainOptionEntries(options);
  if (entries === null || (zoneRequired && !hasZoneString(entries))) {
    return null;
  }
  return kind + JSON.stringify([locale, entries]);
}

/**
 * The locale list as the caller wrote it: an array is read once, here, so the key, the D37 check
 * and the constructor see the same strings even when the array is a Proxy that answers each read
 * differently. Its tags are checked through `Intl.getCanonicalLocales` (ECMA-402
 * CanonicalizeLocaleList), so a bad list throws before the options are read, as in the
 * constructors, but kept as written: hosts canonicalize aliases differently, and D37 reads the
 * written form. A value that is not `undefined`, a string or an array throws `TypeError`, which
 * every caller turns into its sentinel. So does a list with an entry that is not a string.
 */
function canonicalLocale(locale: FormatterLocale): FormatterLocale {
  // A string stays as it is: its canonical form is the constructor's to read.
  if (typeof locale === "string" || locale === undefined) {
    return locale;
  }
  const written = writtenLocaleTags(locale);
  Intl.getCanonicalLocales(written);
  return written;
}

/**
 * A shared, read-only formatter for these arguments; built on the first call with them.
 *
 * A formatter's output is fixed by its constructor arguments and the host's locale data. A
 * `DateTimeFormat` also reads the default locale and default time zone, so it is cached only
 * with a `locale` string (or array of strings) and a `timeZone` string; any other argument
 * set is constructed fresh, exactly as `new Intl[kind](locale, options)` would. A construction
 * failure throws and is never cached. A formatter is kept only while `Intl[kind]` is the
 * constructor that built it.
 *
 * @param kind which `Intl` formatter class to build
 * @param locale BCP 47 locale or locales, or `undefined` for the runtime default
 * @param options the formatter's options, built by GMT code
 * @returns the formatter
 *
 * @example cachedFormatter("DateTimeFormat", "en-GB", { timeZone: "UTC" }).format(0) // "01/01/1970"
 * @example cachedFormatter("ListFormat", "en", { type: "conjunction" }).format(["a", "b"]) // "a and b"
 * @example cachedFormatter("DateTimeFormat", "not a locale", { timeZone: "UTC" }) // throws RangeError
 */
export function cachedFormatter<K extends FormatterKind>(
  kind: K,
  locale: FormatterLocale,
  options: object,
): InstanceType<(typeof Intl)[K]> {
  locale = canonicalLocale(locale);
  const key = cacheKey(kind, locale, options, kind === "DateTimeFormat");
  if (key === null) {
    return construct(kind, locale, options) as InstanceType<(typeof Intl)[K]>;
  }
  forgetIfReplaced(kind);
  let byKey = formatters.get(kind);
  const hit = byKey?.get(key);
  if (hit !== undefined) {
    return hit as InstanceType<(typeof Intl)[K]>;
  }
  const built = construct(kind, locale, options);
  if (byKey === undefined) {
    byKey = new Map();
    formatters.set(kind, byKey);
  } else if (byKey.size >= MAX_ENTRIES_PER_KIND) {
    byKey.clear();
  }
  byKey.set(key, built);
  return built as InstanceType<(typeof Intl)[K]>;
}

/**
 * Construct once to raise the error `Intl` raises for these arguments; a repeat is a no-op.
 *
 * Whether construction throws does not depend on the default zone, so the arguments need no
 * `timeZone`. Only a success is remembered; an invalid call throws every time.
 *
 * @param kind which `Intl` formatter class to build
 * @param locale BCP 47 locale or locales, or `undefined` for the runtime default
 * @param options the formatter's options, built by GMT code
 *
 * @example checkFormatterArguments("DateTimeFormat", "en-GB", { dateStyle: "long" }) // returns
 * @example checkFormatterArguments("DateTimeFormat", "en-GB", { dateStyle: "huge" }) // throws RangeError
 */
export function checkFormatterArguments(
  kind: FormatterKind,
  locale: FormatterLocale,
  options: object,
): void {
  locale = canonicalLocale(locale);
  const key = cacheKey(kind, locale, options, false);
  if (key === null) {
    construct(kind, locale, options, false);
    return;
  }
  forgetIfReplaced(kind);
  let seen = checked.get(kind);
  if (seen?.has(key)) {
    return;
  }
  construct(kind, locale, options, false);
  if (seen === undefined) {
    seen = new Set();
    checked.set(kind, seen);
  } else if (seen.size >= MAX_ENTRIES_PER_KIND) {
    seen.clear();
  }
  seen.add(key);
}

/** Test seam: forget every cached formatter and every checked argument set. */
export function clearFormatterCache(): void {
  formatters.clear();
  checked.clear();
  builtWith.clear();
  forgetWeekYearVerdicts();
}
