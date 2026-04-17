import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return a localized string for a PlainTime ISO input using Intl options.
 *
 * - Uses Temporal.PlainTime.toLocaleString for formatting.
 * - Accepts optional BCP 47 locale and Intl.DateTimeFormatOptions.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainTime string
 * @param locale optional BCP 47 locale identifier
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized time string or "" on invalid input
 *
 * @example formatTime("14:30:00", "en-US", { timeStyle: "short" }) // "2:30 PM"
 * @example formatTime("14:30:00", "de-DE", { timeStyle: "short" }) // "14:30"
 * @example formatTime("invalid") // ""
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
