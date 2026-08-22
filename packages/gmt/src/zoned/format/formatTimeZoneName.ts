import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Name style for `formatTimeZoneName`, mirroring
 * `Intl.DateTimeFormatOptions`'s `timeZoneName` values.
 */
export type TimeZoneNameStyle =
  | "short"
  | "long"
  | "shortOffset"
  | "longOffset"
  | "shortGeneric"
  | "longGeneric";

export interface FormatTimeZoneNameOptions {
  style?: TimeZoneNameStyle;
}

/**
 * Return the localized display name for an IANA timeZone.
 *
 * - `options.style` covers every `Intl.DateTimeFormatOptions` `timeZoneName`
 *   value: "short" (EST), "long" (Eastern Standard Time), "shortOffset"
 *   (GMT-5), "longOffset" (GMT-05:00), "shortGeneric" (ET), "longGeneric"
 *   (Eastern Time). Default "long".
 * - "short"/"long"/"shortOffset"/"longOffset" name the zone's *current*
 *   offset — for a DST-observing zone the label flips between standard and
 *   daylight names depending on when this is called, since there's no
 *   instant parameter to pin it to (this matches how
 *   `Intl.DateTimeFormat.prototype.format()` itself defaults to "now" when
 *   called with no argument). "shortGeneric"/"longGeneric" are
 *   season-independent (e.g. "ET", "Eastern Time") and don't have this
 *   issue — prefer them for a name that won't change twice a year.
 * - Output depends on runtime ICU data.
 * - Returns "" for an invalid timeZone or locale.
 *
 * @param timeZone IANA timeZone identifier
 * @param locale BCP 47 locale tag (e.g. "en-US")
 * @param options optional: { style } name style, default "long"
 * @returns localized zone name, or "" on invalid input
 *
 * @example formatTimeZoneName("America/New_York", "en-US", { style: "shortGeneric" }) // "ET"
 * @example formatTimeZoneName("America/New_York", "en-US", { style: "longGeneric" }) // "Eastern Time"
 * @example formatTimeZoneName("America/New_York", "en-US", { style: "shortOffset" }) // "GMT-4" or "GMT-5", depending on the current date
 * @example formatTimeZoneName("Asia/Tokyo", "ja-JP", { style: "longGeneric" }) // "日本標準時"
 * @example formatTimeZoneName("Invalid/Zone", "en-US") // ""
 * @example formatTimeZoneName("America/New_York", "!!!") // ""
 */
export function formatTimeZoneName(
  timeZone: string,
  locale: string,
  options?: FormatTimeZoneNameOptions,
): string {
  if (!isValidTimeZone(timeZone)) {
    return "";
  }

  try {
    new Intl.Locale(locale);
  } catch {
    return "";
  }

  try {
    const style = options?.style ?? "long";
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: style,
      hour: "numeric",
    });

    const parts = formatter.formatToParts(
      Temporal.Now.instant().epochMilliseconds,
    );
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
