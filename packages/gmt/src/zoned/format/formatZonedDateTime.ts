import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Format a zoned ISO 8601 datetime string using the Intl.DateTimeFormat implementation.
 *
 * - Uses Temporal.ZonedDateTime.toLocaleString for formatting.
 * - Accepts optional locale and Intl.DateTimeFormatOptions.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale optional locale tag (e.g. "en-US")
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized string or "" when invalid
 *
 * @example formatZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]", "en-US", { dateStyle: "long", timeStyle: "long" }) // "February 29, 2024 at 12:34:56 PM Coordinated Universal Time"
 * @example formatZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]", "en-GB", { dateStyle: "short", timeStyle: "short" }) // "29/02/2024, 12:34"
 * @example formatZonedDateTime("invalid", "en-US") // "" (invalid input)
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
