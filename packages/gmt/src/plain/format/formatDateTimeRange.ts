import { Temporal, Intl as TemporalIntl } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Format a plain datetime range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Plain counterpart of `formatZonedRange` — same parameter order and option shape.
 * - Uses Temporal.PlainDateTime.from for both endpoints; no timezone is involved.
 * - Locale elides shared fields between `start` and `end` (e.g. same day/month/year).
 * - Returns "" for invalid input on either endpoint.
 *
 * @param start ISO PlainDateTime string (range start)
 * @param end ISO PlainDateTime string (range end)
 * @param locale optional locale tag
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized range string or "" when invalid
 *
 * @example formatDateTimeRange("2024-02-03T09:00:00", "2024-02-03T17:00:00", "en-US", { dateStyle: "long", timeStyle: "short" }) // "February 3, 2024, 9:00 AM – 5:00 PM"
 * @example formatDateTimeRange("2024-02-03T09:00:00", "2024-02-10T17:00:00", "en-US", { dateStyle: "long", timeStyle: "short" }) // "February 3, 2024 at 9:00 AM – February 10, 2024 at 5:00 PM"
 * @example formatDateTimeRange("invalid", "2024-02-03T17:00:00", "en-US") // "" (invalid input)
 */
export function formatDateTimeRange(
  start: string,
  end: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidDateTime(start) || !isValidDateTime(end)) {
    return "";
  }

  try {
    const out = new TemporalIntl.DateTimeFormat(locale, options).formatRange(
      Temporal.PlainDateTime.from(start),
      Temporal.PlainDateTime.from(end),
    );
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
