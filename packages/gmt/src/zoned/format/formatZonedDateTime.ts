import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Format a zoned ISO 8601 datetime string using the Intl.DateTimeFormat
 * implementation from the Temporal polyfill.
 *
 * - `value` must be a valid zoned ISO 8601 string.
 * - `locale` and `options` are forwarded to the Temporal Intl formatter.
 * - Returns an empty string "" for invalid input or on formatting errors.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale optional locale tag (e.g. "en-US")
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized string or empty string when invalid
 */
export function formatZonedDateTime(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    const out = zonedDateTime.toLocaleString(locale, options);
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
