import { isZoneId } from "./inputChecks";

/**
 * A locale argument: one BCP 47 tag, or a preference list of tags (ECMA-402 `locales`).
 */
export type LocalesArgument = string | string[];

/**
 * The tags of a `locale` argument as the caller wrote them, read as the types say: an omitted
 * locale, a string, or an array whose every entry is a primitive string. `Intl.getCanonicalLocales`
 * would convert a boxed `String` or an object with a `toString` into a tag, and read a hole as
 * `"undefined"`, so each entry is checked first. The array is read once, so the check and every
 * later reader see the same strings even for a Proxy. The tags are not checked for well-formedness.
 *
 * @param locales raw locale argument from caller input
 * @returns the tags as written (`[]` for an omitted locale or an empty list)
 * @throws TypeError for a value that is not `undefined`, a string or an array of strings
 *
 * @example writtenLocaleTags("EN-gb") // ["EN-gb"]
 * @example writtenLocaleTags(["de-DE", , "en"]) // ["de-DE", "en"]
 * @example writtenLocaleTags([new String("de-DE")]) // throws TypeError
 */
export function writtenLocaleTags(locales: unknown): string[] {
  if (locales === undefined) {
    return [];
  }
  if (typeof locales === "string") {
    return [locales];
  }
  if (!Array.isArray(locales)) {
    throw new TypeError("locale must be a string or an array of strings");
  }
  // ECMA-402 CanonicalizeLocaleList reads a list as HasProperty then Get for each index, once, so
  // a hole is skipped and a Proxy trap that throws is heard; the snapshot is what gets checked.
  const entries: unknown[] = [];
  for (let index = 0; index < locales.length; index += 1) {
    if (index in locales) {
      entries.push((locales as unknown[])[index]);
    }
  }
  if (!entries.every((entry) => typeof entry === "string")) {
    throw new TypeError("every locale must be a string");
  }
  return entries as string[];
}

/**
 * The canonical tags of a `locale` argument (ECMA-402 CanonicalizeLocaleList), read once through
 * `writtenLocaleTags`.
 *
 * @param locales raw locale argument from caller input
 * @returns the canonical tags (`[]` for an omitted locale or an empty list)
 * @throws TypeError for a value that is not `undefined`, a string or an array of strings
 * @throws RangeError for a tag that is not well formed
 *
 * @example canonicalLocaleTags("EN-gb") // ["en-GB"]
 * @example canonicalLocaleTags(["de-DE", "en"]) // ["de-DE", "en"]
 * @example canonicalLocaleTags([new String("de-DE")]) // throws TypeError
 */
export function canonicalLocaleTags(locales: unknown): string[] {
  return Intl.getCanonicalLocales(writtenLocaleTags(locales));
}

/**
 * Resolve a `locale` argument to the single BCP 47 tag a locale-aware function reads.
 *
 * - Follows ECMA-402 CanonicalizeLocaleList: a string is a one-tag list, every tag is
 *   canonicalized (`"EN-gb"` → `"en-GB"`) and duplicates are dropped.
 * - The first tag with available locale data wins (`Intl.DateTimeFormat.supportedLocalesOf`), as
 *   ECMA-402's locale negotiation picks; a list with no available tag keeps its first tag, exactly
 *   as that tag passed alone would be read.
 * - `undefined` and an empty list resolve to the default locale.
 * - A malformed tag anywhere in the list, a non-string element, or any other type is invalid and
 *   resolves to `null`, which callers map to their sentinel (ECMA-402 throws a RangeError/TypeError).
 *
 * @param locales raw locale argument from caller input
 * @returns the resolved BCP 47 tag, or `null` when the argument is invalid
 */
export function resolveLocale(locales: unknown): string | null {
  try {
    const canonical = canonicalLocaleTags(locales);
    if (canonical.length === 0) {
      return new Intl.DateTimeFormat().resolvedOptions().locale;
    }
    if (canonical.length === 1) return canonical[0] ?? null;

    return (
      Intl.DateTimeFormat.supportedLocalesOf(canonical)[0] ??
      canonical[0] ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Resolve the `locale` argument of a function whose locale is required, to the single BCP 47 tag
 * it reads, or `null` (the caller's sentinel).
 *
 * - An omitted locale (`undefined`) and an empty list both name no locale, so both are `null`.
 *   ECMA-402 would resolve an empty list to the host default locale; a required locale exists to
 *   keep the result independent of the host, so GMT treats `[]` as omitted (house rule).
 * - Anything else resolves as `resolveLocale` does.
 *
 * @param locales raw locale argument from caller input
 * @returns the resolved BCP 47 tag, or `null` when the argument is omitted, empty or invalid
 *
 * @example resolveRequiredLocale("EN-gb") // "en-GB"
 * @example resolveRequiredLocale(undefined) // null
 * @example resolveRequiredLocale([]) // null
 */
export function resolveRequiredLocale(locales: unknown): string | null {
  if (locales === undefined) return null;
  if (Array.isArray(locales) && locales.length === 0) return null;
  return resolveLocale(locales);
}

/**
 * The host's default time zone identifier, read fresh on every call because it depends on a
 * process default and is never remembered.
 *
 * @returns the IANA name or offset the host reports, or `""` when it reports none or an invalid one
 *
 * @example systemTimeZone() // "Europe/Berlin"
 */
export function systemTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isZoneId(timeZone) ? timeZone : "";
  } catch {
    return "";
  }
}
