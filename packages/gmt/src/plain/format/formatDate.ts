import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return a localized string for a PlainDate ISO input using Intl options.
 *
 * - Uses Temporal.PlainDate.toLocaleString for formatting.
 * - Accepts optional BCP 47 locale and Intl.DateTimeFormatOptions.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDate string
 * @param locale optional BCP 47 locale identifier
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized date string or "" on invalid input
 *
 * @example formatDate("2024-03-15", "en-US", { year: "numeric", month: "long", day: "numeric" }) // "March 15, 2024"
 * @example formatDate("2024-03-15", "de-DE", { year: "numeric", month: "long", day: "numeric" }) // "15. März 2024"
 * @example formatDate("invalid") // ""
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
