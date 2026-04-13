import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
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
 * @example formatDate("2024-03-15", "en-US", { year: "numeric", month: "long", day: "numeric" }) // "March 15, 2024"
 * @example formatDate("2024-03-15", "de-DE", { year: "numeric", month: "long", day: "numeric" }) // "15. März 2024"
 * @example formatDate("invalid") // ""
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
    const out = Temporal.PlainDate.from(value).toLocaleString(locale, options);
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
