import { Temporal, Intl as TemporalIntl } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Format a plain date range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Plain counterpart of `formatZonedRange` — same parameter order and option shape.
 * - Uses Temporal.PlainDate.from for both endpoints; no timezone is involved.
 * - Locale elides shared fields between `start` and `end` (e.g. same month/year).
 * - Returns "" for invalid input on either endpoint.
 *
 * @param start ISO PlainDate string (range start)
 * @param end ISO PlainDate string (range end)
 * @param locale optional locale tag
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized range string or "" when invalid
 *
 * @example formatDateRange("2024-02-03", "2024-02-05", "en-US", { dateStyle: "long" }) // "February 3 – 5, 2024"
 * @example formatDateRange("2024-02-03", "2024-06-10", "en-US", { dateStyle: "long" }) // "February 3 – June 10, 2024"
 * @example formatDateRange("invalid", "2024-02-05", "en-US") // "" (invalid input)
 */
export function formatDateRange(
  start: string,
  end: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidDate(start) || !isValidDate(end)) {
    return "";
  }

  try {
    const out = new TemporalIntl.DateTimeFormat(locale, options).formatRange(
      Temporal.PlainDate.from(start),
      Temporal.PlainDate.from(end),
    );
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
