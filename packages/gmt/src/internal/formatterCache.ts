import { plainOptionEntries } from "./plainOptionEntries";
import { forgetWeekYearVerdicts, guardDateTimeFormat } from "./weekYearGuard";
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
 * A date formatter with the week-year guard (D23, D24) and no year repair (D25 to D27): its parts
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
  return guardDateTimeFormat(
    built === options ? native : new Intl.DateTimeFormat(locale, built),
    built,
  );
}

function construct(
  kind: FormatterKind,
  locale: FormatterLocale,
  options: object,
): object {
  switch (kind) {
    case "DateTimeFormat":
      return repairYearPrinting(
        guardedDateTimeFormat(locale, options as Intl.DateTimeFormatOptions),
        options as Intl.DateTimeFormatOptions,
        (twin) => cachedFormatter("DateTimeFormat", locale, twin),
      );
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
 * locale is already canonical (see `canonicalLocale`).
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
 * The locale list as `Intl` canonicalizes it (ECMA-402 CanonicalizeLocaleList): an array is read
 * once, here, through `Intl.getCanonicalLocales`, so the key and the constructor see the same
 * strings even when the array is a Proxy that answers each read differently, and a bad list
 * throws before the options are read, as in the constructors.
 */
function canonicalLocale(locale: FormatterLocale): FormatterLocale {
  return Array.isArray(locale) ? Intl.getCanonicalLocales(locale) : locale;
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
    construct(kind, locale, options);
    return;
  }
  forgetIfReplaced(kind);
  let seen = checked.get(kind);
  if (seen?.has(key)) {
    return;
  }
  construct(kind, locale, options);
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
