import type { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime, zonedDateTimeFrom } from "../../internal";
import { instantFormatOptions } from "../../internal/instantFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Format a zoned datetime range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Both datetimes must have the same timezone.
 * - Formats both instants as Temporal's ECMA-402 Instant format does, through the runtime's
 *   `Intl.DateTimeFormat#formatRange` in the endpoints' zone: the requested fields and widths are
 *   kept, and with no date or time field (`era` alone included) the date and time are the
 *   defaults.
 * - Returns "" for invalid input, mismatched timezones, or a `timeZone` option (a ZonedDateTime
 *   keeps its own zone).
 * - **Compatibility:** before 1.16.0 some locales lost a requested width (zh-CN with
 *   `{ year: "numeric", month: "long" }` gave `"2024/2"`), `era` alone dropped the time, and a
 *   `timeZone` option was silently overridden by the endpoints' zone. Pass the fields the old text
 *   showed to keep it, and drop the `timeZone` option to keep the endpoints' zone.
 * - Output is normalized: dash separators become ASCII "-" (unspaced between digits, spaced
 *   otherwise), and no-break, narrow and thin spaces become U+0020.
 *
 * @param from zoned ISO 8601 datetime string (range start)
 * @param to zoned ISO 8601 datetime string (range end)
 * @param locale optional locale tag
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized range string or "" when invalid
 *
 * @example formatZonedRange("2024-02-29T12:00:00.000+00:00[UTC]", "2024-02-29T14:00:00.000+00:00[UTC]", "en-US", { dateStyle: "long", timeStyle: "short" }) // "February 29, 2024, 12:00 - 2:00 PM"
 * @example formatZonedRange("2024-02-29T12:00:00.000+00:00[UTC]", "2024-02-29T14:00:00.000+00:00[UTC]", "en-GB", { dateStyle: "short", timeStyle: "short" }) // "29/02/2024, 12:00-14:00"
 * @example formatZonedRange("2024-02-03T14:30:45-05:00[America/New_York]", "2024-02-03T15:30:45-05:00[America/New_York]", "zh-CN", { year: "numeric", month: "long" }) // "2024年2月"
 * @example formatZonedRange("2024-02-03T14:30:45-05:00[America/New_York]", "2024-02-03T15:30:45-05:00[America/New_York]", "en-US", { era: "long" }) // "2/3/2024 Anno Domini, 2:30:45 PM - 3:30:45 PM"
 * @example formatZonedRange("2024-02-29T10:00:00-05:00[America/New_York]", "2024-02-29T12:00:00-05:00[America/New_York]", "en-US", { hour: "numeric", timeZone: "UTC" }) // "" — a ZonedDateTime keeps its own zone
 * @example formatZonedRange("2024-02-29T10:00:00-05:00[America/New_York]", "2024-02-29T12:00:00-05:00[America/New_York]", "en-US", { hour: "numeric", minute: "numeric", timeZoneName: "short" }) // "10:00 AM - 12:00 PM EST" — the pre-1.16.0 text
 * @example formatZonedRange("invalid", "2024-02-29T14:00:00.000+00:00[UTC]", "en-US") // "" (invalid input)
 */
export function formatZonedRange(
  from: string,
  to: string,
  locale?: string,
  options?: DateTimeFormatOptions,
): string {
  if (!isValidZonedDateTime(from) || !isValidZonedDateTime(to)) {
    return "";
  }

  let zdt1: Temporal.ZonedDateTime;
  let zdt2: Temporal.ZonedDateTime;
  try {
    zdt1 = zonedDateTimeFrom(from);
    zdt2 = zonedDateTimeFrom(to);
  } catch {
    return "";
  }

  if (zdt1.timeZoneId !== zdt2.timeZoneId) {
    return "";
  }

  // Both instants are formatted in the endpoints' own zone with the options
  // an Instant format resolves to (GetDateTimeFormat ~any~, ~all~, ~all~), so
  // the requested fields and widths are kept. A `timeZone` option is rejected
  // rather than silently overridden.
  const formatOptions = instantFormatOptions(
    options ?? {},
    zdt1.timeZoneId,
    "all",
  );
  if (formatOptions === null) {
    return "";
  }

  try {
    const out = new Intl.DateTimeFormat(locale, formatOptions).formatRange(
      zdt1.epochMilliseconds,
      zdt2.epochMilliseconds,
    );
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
