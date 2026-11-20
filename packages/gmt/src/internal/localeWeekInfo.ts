import { type LocalesArgument, resolveRequiredLocale } from "./resolveLocale";
import {
  isFirstDayRefused,
  isLanguageFirstDayRefused,
  isLanguageWeekendRefused,
  isWeekendRefused,
  REPAIRED_DEPRECATED_REGIONS,
  UNCANONICALIZED_DEPRECATED_REGIONS,
} from "./weekDataRefusal";

// TypeScript's lib.es2024.intl.d.ts (as of TS 5.9) declares neither form of the Intl Locale
// Info proposal's week data. Augment the ambient type once, here, rather than widening every
// call site with `as unknown as`.
interface LocaleWeekInfo {
  firstDay: number;
  weekend: number[];
  minimalDays: number;
}

declare global {
  namespace Intl {
    interface Locale {
      /** The proposal's current API. V8 12.x and later (Node 24, Node 26). */
      getWeekInfo?(): Partial<LocaleWeekInfo>;
      /** The proposal's earlier accessor. Removed in V8 14 (Node 26); present on Node 22/24. */
      readonly weekInfo?: Partial<LocaleWeekInfo>;
    }
  }
}

/**
 * A locale's week data: the first day, the weekend and the minimal days.
 *
 * `null` marks a value GMT refuses (compat D36); `undefined` marks a value the runtime does not
 * expose.
 */
export interface ResolvedWeekInfo {
  firstDay?: number | null;
  weekend?: number[] | null;
  minimalDays?: number;
}

// The ISO day number (1 = Monday) of each `fw` value (UTS #35 Part 1 § 3.6.4, key `fw`).
const FIRST_DAY_KEYWORDS: Readonly<Record<string, number>> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

/** The Unicode extension keywords of a tag: `en-u-ca-gregory-fw-mon` gives `ca` and `fw`. */
function unicodeKeywords(tag: string): Map<string, string> {
  const keywords = new Map<string, string>();
  const subtags = tag.toLowerCase().split("-");
  const start = subtags.indexOf("u");
  if (start === -1) return keywords;
  let key = "";
  for (let index = start + 1; index < subtags.length; index += 1) {
    const subtag = subtags[index] ?? "";
    if (subtag.length === 1) break;
    if (subtag.length === 2) {
      key = subtag;
      keywords.set(key, "");
    } else if (key !== "") {
      const value = keywords.get(key);
      keywords.set(key, value ? `${value}-${subtag}` : subtag);
    }
  }
  return keywords;
}

/** The region subtag written in a tag, upper case, or `undefined` when it has none. */
function writtenRegion(tag: string): string | undefined {
  const subtags = tag.split("-");
  for (let index = 1; index < subtags.length; index += 1) {
    const subtag = subtags[index] ?? "";
    if (subtag.length === 1) return undefined;
    if (/^(?:[A-Za-z]{2}|\d{3})$/.test(subtag)) return subtag.toUpperCase();
  }
  return undefined;
}

/**
 * The entry of a locale argument that resolved to `resolved`, as the caller wrote it: runtimes
 * canonicalize a deprecated region differently, so the written form is the only one every runtime
 * shows the same way.
 */
function writtenTag(locale: LocalesArgument, resolved: string): string {
  const entries = typeof locale === "string" ? [locale] : locale;
  for (const entry of entries) {
    try {
      if (Intl.getCanonicalLocales(entry)[0] === resolved) return entry;
    } catch {
      // A malformed entry never resolved, so it is not the one we are looking for.
    }
  }
  return resolved;
}

/**
 * A locale's CLDR week data, one value on every runtime (compat D36), from whichever form of the
 * Intl Locale Info proposal the runtime implements.
 *
 * - The week region is the `-u-rg-` region when the tag has a valid one, else the tag's region,
 *   else its likely region (`zh` is `CN`), else `001` (UTS #35 Part 4 § 4, Part 1 § 3.6.5). The
 *   runtime is then asked about that region alone, so its own reading of `rg`, variants and
 *   scripts never matters.
 * - A deprecated region is read as its successor where every runtime canonicalizes it, and
 *   refused where some runtime does not (`weekDataRefusal.ts`).
 * - `-u-fw-<day>` names the first day (UTS #35 Part 1 § 3.6.4); GMT maps the keyword itself.
 * - The first day and the weekend are `null` for a region some runtime does not read as CLDR
 *   does (`weekDataRefusal.ts`); callers turn that into their sentinel.
 * - Returns `undefined` when neither form is available. Fields may be missing: Node 24/26 omit
 *   `minimalDays`. Callers apply their own ISO defaults.
 * - Throws `RangeError` (from `Intl.Locale`) if `locale` is not a well-formed BCP 47 tag; callers turn
 *   that into their sentinel.
 *
 * @example localeWeekInfo("pt-BR")?.firstDay // 7
 * @example localeWeekInfo("ar-SA")?.weekend // [5, 6]
 * @example localeWeekInfo("zh-CN")?.firstDay // null, refused
 * @example localeWeekInfo("zh-CN-u-fw-mon")?.firstDay // 1
 */
export function localeWeekInfo(
  locale: LocalesArgument,
): ResolvedWeekInfo | undefined {
  const resolved = resolveRequiredLocale(locale);
  if (resolved === null) throw new RangeError("Invalid locale");

  // Canonical form read back through the constructor: some runtimes leave `.region` as written
  // (`BU`) while `toString()` already holds the successor (`MM`).
  const canonical = new Intl.Locale(new Intl.Locale(resolved).toString());
  const keywords = unicodeKeywords(canonical.toString());

  const rgMatch = /^([a-z]{2})[a-z0-9]{3,4}$/.exec(keywords.get("rg") ?? "");
  const rgRegion = rgMatch?.[1]?.toUpperCase();
  const written = writtenRegion(writtenTag(locale, resolved));
  const deprecatedKept =
    (written !== undefined &&
      UNCANONICALIZED_DEPRECATED_REGIONS.has(written)) ||
    (rgRegion !== undefined &&
      (UNCANONICALIZED_DEPRECATED_REGIONS.has(rgRegion) ||
        REPAIRED_DEPRECATED_REGIONS.has(rgRegion)));
  const explicitRegion = rgRegion ?? canonical.region;
  const region = explicitRegion ?? canonical.maximize().region ?? "001";
  // The region came from likely subtags, which runtimes carry in different releases.
  const likely =
    explicitRegion === undefined
      ? [
          canonical.language,
          writtenTag(locale, resolved).split("-")[0]?.toLowerCase() ?? "",
        ]
      : [];

  const dataLocale = new Intl.Locale(`und-${region}`);
  const info:
    | Partial<{
        firstDay: number;
        weekend: number[];
        minimalDays: number;
      }>
    | undefined =
    typeof dataLocale.getWeekInfo === "function"
      ? dataLocale.getWeekInfo()
      : dataLocale.weekInfo;
  if (!info) return undefined;

  const named = FIRST_DAY_KEYWORDS[keywords.get("fw") ?? ""];
  const refusedFirstDay =
    deprecatedKept ||
    isFirstDayRefused(region) ||
    likely.some(isLanguageFirstDayRefused);
  const refusedWeekend =
    deprecatedKept ||
    isWeekendRefused(region) ||
    likely.some(isLanguageWeekendRefused);
  return {
    firstDay: named ?? (refusedFirstDay ? null : info.firstDay),
    weekend: refusedWeekend ? null : info.weekend,
    minimalDays: info.minimalDays,
  };
}
