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

function construct(
  kind: FormatterKind,
  locale: FormatterLocale,
  options: object,
): object {
  switch (kind) {
    case "DateTimeFormat":
      return new Intl.DateTimeFormat(
        locale,
        options as Intl.DateTimeFormatOptions,
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

/** Whether `Intl` can read this option value without running caller code. */
function isPlainOptionValue(value: unknown): boolean {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/**
 * The own enumerable options as `[name, value]` pairs, read through property descriptors so a
 * getter is never run, or `null` when one is an accessor or holds a value `Intl` would coerce
 * by running caller code (anything but a string, a finite number or a boolean). An `undefined`
 * value is skipped, as `Intl` reads it as absent.
 */
function plainOptionEntries(options: object): [string, unknown][] | null {
  const entries: [string, unknown][] = [];
  for (const name of Object.keys(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (descriptor === undefined || !("value" in descriptor)) {
      return null;
    }
    const value: unknown = descriptor.value;
    if (value === undefined) {
      continue;
    }
    if (!isPlainOptionValue(value)) {
      return null;
    }
    entries.push([name, value]);
  }
  return entries;
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
 * failure throws and is never cached.
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
}
