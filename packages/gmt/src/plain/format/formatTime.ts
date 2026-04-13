import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return a localized string for a PlainTime ISO input using Intl options.
 *
 * - Delegates to Temporal.PlainTime.toLocaleString with the provided
 *   `locale` and `options`.
 * - Returns an empty string for invalid input or on error.
 *
 * @param value ISO PlainTime string
 * @param locale optional BCP 47 locale identifier
 * @param options optional Intl.DateTimeFormatOptions
 * @example formatTime("14:30:00", "en-US", { timeStyle: "short" }) // "2:30 PM"
 * @example formatTime("14:30:00", "de-DE", { timeStyle: "short" }) // "14:30"
 * @example formatTime("invalid") // ""
 * @returns localized time string or "" on invalid input
 */
export function formatTime(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isValidTime(value)) {
    return "";
  }

  try {
    const out = Temporal.PlainTime.from(value).toLocaleString(locale, options);
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
