import { normalizeDateTime, zonedDateTimeFrom } from "../../internal";
import { instantFormatOptions } from "../../internal/instantFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Format a zoned ISO 8601 datetime string using the Intl.DateTimeFormat implementation.
 *
 * - Formats as Temporal's ECMA-402 ZonedDateTime format (`ZonedDateTime#toLocaleString`) does,
 *   through the runtime's `Intl.DateTimeFormat` in the value's own zone: the requested fields and
 *   widths are kept, and with no date or time field (`era` alone included) the date, time and a
 *   short zone name are the defaults.
 * - Accepts optional locale and Intl.DateTimeFormatOptions.
 * - Returns "" for invalid input, and for a `timeZone` option, where
 *   `ZonedDateTime#toLocaleString` throws a TypeError.
 * - Output is normalized: dash separators become ASCII "-" (unspaced between digits, spaced
 *   otherwise), and no-break, narrow and thin spaces become U+0020.
 * - **Compatibility:** before 1.16.0 some locales and calendars lost a requested width (ja-JP with
 *   the japanese calendar and `month: "long"` gave `"R6/2"`) and `era` alone dropped the time and
 *   zone name. Pass the fields the old text showed to keep it. To render in another zone, use
 *   `formatUtc` with its `timeZone` option.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it (a string or number
 *   options value formats with the defaults, as `Intl.DateTimeFormat` does).
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale optional locale tag (e.g. "en-US"), or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized string or "" when invalid
 *
 * @example formatZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]", "en-US", { dateStyle: "long", timeStyle: "long" }) // "February 29, 2024 at 12:34:56 PM UTC"
 * @example formatZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]", "en-GB", { dateStyle: "short", timeStyle: "short" }) // "29/02/2024, 12:34"
 * @example formatZonedDateTime("2024-02-03T14:30:45-05:00[America/New_York]", "ja-JP-u-ca-japanese", { year: "numeric", month: "long" }) // "令和6年2月"
 * @example formatZonedDateTime("2024-02-03T14:30:45-05:00[America/New_York]", "ja-JP-u-ca-japanese", { year: "numeric", month: "numeric" }) // "R6/2" — the pre-1.16.0 text
 * @example formatZonedDateTime("2024-02-03T14:30:45-05:00[America/New_York]", "en-US", { era: "long" }) // "2/3/2024 Anno Domini, 2:30:45 PM EST"
 * @example formatZonedDateTime("2024-02-03T14:30:45-05:00[America/New_York]", "en-US", { era: "long", year: "numeric", month: "numeric", day: "numeric" }) // "2/3/2024 Anno Domini" — the pre-1.16.0 text
 * @example formatZonedDateTime("2024-02-03T14:30:45-05:00[America/New_York]", "en-US", { timeZone: "Asia/Tokyo" }) // "" — a ZonedDateTime keeps its own zone
 * @example formatUtc("2024-02-03T19:30:45Z", "en-US", { timeZone: "Asia/Tokyo", includeTimeZoneName: true }) // "2/4/2024, 4:30:45 AM GMT+9" — the same instant in another zone
 * @example formatZonedDateTime("invalid", "en-US") // "" (invalid input)
 * @example formatZonedDateTime("2024-02-03T14:30:45+01:00[Europe/Paris]", ["fr-FR", "en-US"], { dateStyle: "short", timeStyle: "short" }) // "03/02/2024 14:30"
 * @example formatZonedDateTime("2024-02-03T14:30:00-05:00[America/New_York]", "en-US", null as never) // "" (null options, as ECMA-402 rejects them)
 */
export function formatZonedDateTime(
  value: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  // ECMA-402 CoerceOptionsToObject: null options throw TypeError, so they are invalid input.
  if (options === null) {
    return "";
  }
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    // The runtime's Intl.DateTimeFormat formats the instant in the value's own
    // zone with the options ZonedDateTime#toLocaleString resolves to
    // (GetDateTimeFormat ~any~, ~zoned-date-time~, ~all~), so the requested
    // fields and widths are kept.
    const zonedDateTime = zonedDateTimeFrom(value);
    const resolved = instantFormatOptions(
      options ?? {},
      zonedDateTime.timeZoneId,
      "zoned-date-time",
    );
    if (resolved === null) {
      return "";
    }
    return normalizeDateTime(
      new Intl.DateTimeFormat(locale, resolved).format(
        zonedDateTime.epochMilliseconds,
      ),
    );
  } catch {
    return "";
  }
}
