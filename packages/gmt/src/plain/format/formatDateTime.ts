import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return a localized string for a PlainDateTime ISO input using Intl options.
 *
 * - Delegates to Temporal.PlainDateTime.toLocaleString with the provided
 *   `locale` and `options`.
 * - Returns an empty string for invalid input or on error.
 *
 * @param value ISO PlainDateTime string
 * @param locale optional BCP 47 locale identifier
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized date-time string or "" on invalid input
 */
export function formatDateTime(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidDateTime(value)) {
    return "";
  }

  try {
    return Temporal.PlainDateTime.from(value).toLocaleString(locale, options);
  } catch {
    return "";
  }
}
