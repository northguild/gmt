/**
 * A locale argument: one BCP 47 tag, or a preference list of tags (ECMA-402 `locales`).
 */
export type LocalesArgument = string | string[];

/**
 * Resolve a `locale` argument to the single BCP 47 tag a locale-aware function reads.
 *
 * - Follows ECMA-402 CanonicalizeLocaleList: a string is a one-tag list, every tag is
 *   canonicalized (`"EN-us"` → `"en-US"`) and duplicates are dropped.
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
  if (
    locales !== undefined &&
    typeof locales !== "string" &&
    !Array.isArray(locales)
  ) {
    return null;
  }

  try {
    const canonical = Intl.getCanonicalLocales(
      locales as LocalesArgument | undefined,
    );
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
 * @example resolveRequiredLocale("EN-us") // "en-US"
 * @example resolveRequiredLocale(undefined) // null
 * @example resolveRequiredLocale([]) // null
 */
export function resolveRequiredLocale(locales: unknown): string | null {
  if (locales === undefined) return null;
  if (Array.isArray(locales) && locales.length === 0) return null;
  return resolveLocale(locales);
}
