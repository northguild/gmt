import { formatWallClockOrZoned } from "../../internal/instantFormatOptions";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { toInstantFromUtc } from "../../internal/toInstantFromUtc";
import { isValidUtc } from "../validate";

/**
 * Options for `formatUtc`. Extends `Intl.DateTimeFormatOptions`; only the
 * added/overridden members are listed below. All `Intl.DateTimeFormatOptions`
 * (`dateStyle`, `timeStyle`, etc.) apply to the time-of-day portion.
 *
 * @remarks Members:
 *
 * | Member | Type | Default | Description |
 * | --- | --- | --- | --- |
 * | `timeZone` | `string` | `"UTC"` | IANA zone for rendering; invalid/omitted falls back to UTC via `normalizeTimeZone`. |
 * | `includeTimeZoneName` | `boolean` | `false` | Appends the localized zone name (style via `Intl`) when true. |
 *
 * @example
 * import { FormatUtcOptions } from "@northguild/gmt/utc";
 * const opts: FormatUtcOptions = { includeTimeZoneName: true };
 */
export interface FormatUtcOptions extends Intl.DateTimeFormatOptions {
  timeZone?: string;
  includeTimeZoneName?: boolean;
}

/**
 * Format a UTC ISO string as a localized date/time string.
 *
 * - Returns `""` if the input is not a valid UTC string.
 * - `timeZone` controls the IANA zone used for rendering; defaults to `"UTC"`.
 * - `includeTimeZoneName` appends the localized timezone name when true.
 * - Without `includeTimeZoneName` the wall clock is formatted as Temporal's ECMA-402 PlainDateTime
 *   format does (`timeZoneName` is ignored); with it, as the ZonedDateTime format does (a short
 *   zone name is added to the defaults). Either way the requested fields and style widths are kept,
 *   and `era` alone still gets the date and time defaults.
 * - **Compatibility:** before 1.16.0 some locales and calendars lost a requested width (ja-JP with
 *   the japanese calendar and `month: "long"` gave `"R6/2"`), a `long`/`full` `timeStyle` replaced
 *   the `dateStyle` width, `era` alone dropped the time, and `timeZoneName` alone without
 *   `includeTimeZoneName` returned `""`. Pass the fields the old text showed to keep it.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { timeZone, includeTimeZoneName }
 * @returns the formatted date/time string, or "" on invalid input
 *
 * @example formatUtc("2026-03-16T18:30:00Z") // "3/16/2026, 6:30:00 PM"
 * @example formatUtc("2026-03-16T18:30:00Z", "en-US", { timeZone: "America/New_York" }) // "3/16/2026, 2:30:00 PM"
 * @example formatUtc("2026-03-16T18:30:00Z", "en-US", { timeZone: "America/New_York", includeTimeZoneName: true }) // "3/16/2026, 2:30:00 PM EDT"
 * @example formatUtc("2024-02-03T14:30:45Z", "ja-JP-u-ca-japanese", { year: "numeric", month: "long" }) // "令和6年2月"
 * @example formatUtc("2024-02-03T14:30:45Z", "ja-JP-u-ca-japanese", { year: "numeric", month: "numeric" }) // "R6/2" — the pre-1.16.0 text
 * @example formatUtc("2024-02-03T14:30:45Z", "en-US", { era: "long" }) // "2/3/2024 Anno Domini, 2:30:45 PM"
 * @example formatUtc("2024-02-03T14:30:45Z", "en-US", { era: "long", year: "numeric", month: "numeric", day: "numeric" }) // "2/3/2024 Anno Domini" — the pre-1.16.0 text
 * @example formatUtc("2024-02-03T14:30:45Z", "en-US", { timeZoneName: "short" }) // "2/3/2024, 2:30:45 PM"
 * @example formatUtc("not-a-date") // ""
 */
export function formatUtc(
  value: string,
  locale?: string,
  options?: FormatUtcOptions,
): string {
  if (!isValidUtc(value)) return "";

  const {
    timeZone,
    includeTimeZoneName = false,
    ...intlOptions
  } = options ?? {};

  const instant = toInstantFromUtc(value);
  if (instant === null) return "";

  try {
    const tz = normalizeTimeZone(timeZone);
    const zdt = instant.toZonedDateTimeISO(tz);
    return normalizeDateTime(
      formatWallClockOrZoned(zdt, locale, intlOptions, includeTimeZoneName),
    );
  } catch {
    return "";
  }
}
