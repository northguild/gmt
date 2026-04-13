import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
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
 * @example formatDateTime("2024-03-15T14:30:00", "en-US", { dateStyle: "medium", timeStyle: "short" }) // "Mar 15, 2024 at 2:30 PM"
 * @example formatDateTime("2024-03-15T14:30:00", "de-DE", { dateStyle: "medium", timeStyle: "short" }) // "15.03.2024, 14:30"
 * @example formatDateTime("invalid") // ""
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
    const out = Temporal.PlainDateTime.from(value).toLocaleString(
      locale,
      options,
    );
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
