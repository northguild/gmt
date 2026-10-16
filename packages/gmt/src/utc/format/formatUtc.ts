// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { formatWallClockOrZoned } from "../../internal/instantFormatOptions";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { toInstantFromUtc } from "../../internal/toInstantFromUtc";
import { isValidUtc } from "../validate";
import { readDateTimeFormatOptions } from "../../internal/readDateTimeFormatOptions";
import { optionOrDefault } from "../../internal/optionOrDefault";

/**
 * Options for `formatUtc`. Extends `Intl.DateTimeFormatOptions`; only the
 * added/overridden members are declared here. All `Intl.DateTimeFormatOptions`
 * (`dateStyle`, `timeStyle`, etc.) apply to the time-of-day portion.
 *
 * @example
 * import { FormatUtcOptions } from "@northguild/gmt/utc";
 * const opts: FormatUtcOptions = { includeTimeZoneName: true };
 */
export interface FormatUtcOptions extends Intl.DateTimeFormatOptions {
  /**
   * The time zone the value is rendered in: an IANA name, a UTC offset to the minute (what
   * `isValidTimeZone` accepts), or `"local"` for the system time zone. An unknown zone returns
   * `""`, as ECMA-402 throws RangeError for it.
   *
   * @defaultValue `"UTC"`
   */
  timeZone?: string;
  /**
   * Whether the localized time zone name is appended. When true the value is formatted as Temporal's
   * ECMA-402 ZonedDateTime format does, which adds a short zone name to the defaults; when false, as
   * the PlainDateTime format does, and `timeZoneName` is ignored.
   *
   * @defaultValue `false`
   */
  includeTimeZoneName?: boolean;
}

/**
 * Format a UTC ISO string as a localized date/time string.
 *
 * - Returns `""` if the input is not a valid UTC string.
 * - The requested fields and style widths are kept, and `era` alone still gets the date and time
 *   defaults.
 * - **Compatibility:** before 1.16.0 some locales and calendars lost a requested width (ja-JP with
 *   the japanese calendar and `month: "long"` gave `"R6/2"`), a `long`/`full` `timeStyle` replaced
 *   the `dateStyle` width, `era` alone dropped the time, and `timeZoneName` alone without
 *   `includeTimeZoneName` returned `""`. Pass the fields the old text showed to keep it.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it.
 * - An offset with seconds (`-00:44:30`) returns `""`. `Intl.DateTimeFormat` takes a time zone
 *   identifier only: constructing one with an offset that has seconds throws (ECMA-402, the
 *   `DateTimeFormat` construction step "If parseResult contains more than one MinuteSecond Parse
 *   Node, throw a RangeError exception"). Pass the IANA name.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options The time zone, the zone-name switch and any `Intl.DateTimeFormatOptions`
 * @returns the formatted date/time string, or "" on invalid input
 *
 * @example formatUtc("2026-03-16T18:30:00Z") // "3/16/2026, 6:30:00 PM" (varies by the runtime's default locale; shown for en-US)
 * @example formatUtc("2026-03-16T18:30:00Z", "ja-JP", { timeZone: "Asia/Tokyo" }) // "2026/3/17 3:30:00"
 * @example formatUtc("2026-03-16T18:30:00Z", "ja-JP", { timeZone: "Asia/Tokyo", includeTimeZoneName: true }) // "2026/3/17 3:30:00 JST"
 * @example formatUtc("2024-02-03T14:30:45Z", "ja-JP-u-ca-japanese", { year: "numeric", month: "long" }) // "令和6年2月"
 * @example formatUtc("2024-02-03T14:30:45Z", "ja-JP-u-ca-japanese", { year: "numeric", month: "numeric" }) // "R6/2" — the pre-1.16.0 text
 * @example formatUtc("2024-02-03T14:30:45Z", "en-GB", { era: "long" }) // "03/02/2024 Anno Domini, 14:30:45"
 * @example formatUtc("2024-02-03T14:30:45Z", "en-GB", { era: "long", year: "numeric", month: "numeric", day: "numeric" }) // "03/02/2024 Anno Domini" — the pre-1.16.0 text
 * @example formatUtc("2024-02-03T14:30:45Z", "de-DE", { timeZoneName: "short" }) // "3.2.2024, 14:30:45"
 * @example formatUtc("2024-02-03T14:30:45Z", "zh-CN", { timeZone: "Europe/Londn" }) // "" (unknown zone)
 * @example formatUtc("2024-02-03T14:30:45Z", "pt-BR", null as never) // "" (null options, as ECMA-402 rejects them)
 * @example formatUtc("not-a-date") // ""
 * @example formatUtc("2024-02-03T14:30:45Z", ["fr-FR", "en-US"], { dateStyle: "long" }) // "3 février 2024"
 */
export function formatUtc(
  value: string,
  locale?: string | string[],
  options?: FormatUtcOptions,
): string {
  try {
    // ECMA-402 CoerceOptionsToObject: undefined is defaults; null is a TypeError.
    if (options === null) return "";
    if (!isValidUtc(value)) return "";

    // Each option is read once (GetOption), inherited ones included.
    const includeTimeZoneName = optionOrDefault(
      options?.includeTimeZoneName,
      false,
    );
    const { timeZone, ...intlOptions } = readDateTimeFormatOptions(options);

    const instant = toInstantFromUtc(value);
    if (instant === null) return "";

    // ECMA-402 throws RangeError for an unknown zone: the sentinel, never a silent UTC.
    const tz = normalizeTimeZone(timeZone);
    if (!tz) return "";

    try {
      const zdt = instant.toZonedDateTimeISO(tz);
      return normalizeDateTime(
        formatWallClockOrZoned(zdt, locale, intlOptions, includeTimeZoneName),
      );
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
