import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return a localized string for a PlainDate ISO input using Intl options.
 *
 * - Delegates to Temporal.PlainDate.toLocaleString with the provided
 *   `locale` and `options`.
 * - Returns an empty string for invalid input or on error.
 *
 * @param value ISO PlainDate string
 * @param locale optional BCP 47 locale identifier
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized date string or "" on invalid input
 */
export function formatDate(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidDate(value)) {
    return "";
  }

  try {
    return Temporal.PlainDate.from(value).toLocaleString(locale, options);
  } catch {
    return "";
  }
}
