import { Temporal } from "@js-temporal/polyfill";
import { resolveRequiredLocale } from "../../internal/resolveLocale";
import { isValidTimeZone } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";
import { optionOrDefault } from "../../internal/optionOrDefault";

/**
 * Name style for `formatTimeZoneName`, mirroring
 * `Intl.DateTimeFormatOptions`'s `timeZoneName` values.
 *
 * @remarks Members:
 *
 * | Member | Example (America/New_York) | Description |
 * | --- | --- | --- |
 * | `short` | `EST`/`EDT` | Abbreviated zone name; seasonal for DST zones. |
 * | `long` | `Eastern Standard Time` | Full zone name; seasonal for DST zones. |
 * | `shortOffset` | `GMT-5` | Short UTC offset; seasonal. |
 * | `longOffset` | `GMT-05:00` | Zero-padded UTC offset; seasonal. |
 * | `shortGeneric` | `ET` | Season-independent generic abbreviation. |
 * | `longGeneric` | `Eastern Time` | Season-independent generic full name. |
 *
 * @example
 * import { TimeZoneNameStyle } from "@northguild/gmt/zoned";
 * const s: TimeZoneNameStyle = "shortGeneric";
 */
export type TimeZoneNameStyle =
  | "short"
  | "long"
  | "shortOffset"
  | "longOffset"
  | "shortGeneric"
  | "longGeneric";

/** Options for `formatTimeZoneName`: the form the zone name is written in. */
export interface FormatTimeZoneNameOptions {
  /**
   * The form of the name, one of `Intl.DateTimeFormat`'s `timeZoneName` values. `"short"` and
   * `"long"` give the abbreviated or full name and `"shortOffset"` and `"longOffset"` the UTC
   * offset, all four for the offset in effect now. `"shortGeneric"` and `"longGeneric"` give a name
   * that does not change with daylight saving.
   *
   * @defaultValue `"long"`
   */
  style?: TimeZoneNameStyle;
}

/**
 * Return the localized display name for an IANA timeZone.
 *
 * - `options.style` covers every `Intl.DateTimeFormatOptions` `timeZoneName`
 *   value: "short" (EST), "long" (Eastern Standard Time), "shortOffset"
 *   (GMT-5), "longOffset" (GMT-05:00), "shortGeneric" (ET), "longGeneric"
 *   (Eastern Time).
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
 * - An offset with seconds (`-00:44:30`) returns `""`. `Intl.DateTimeFormat` takes a time zone
 *   identifier only: constructing one with an offset that has seconds throws (ECMA-402, the
 *   `DateTimeFormat` construction step "If parseResult contains more than one MinuteSecond Parse
 *   Node, throw a RangeError exception"). Pass the IANA name.
 *
 * @param timeZone IANA name or a UTC offset to the minute (what `isValidTimeZone` accepts)
 * @param locale BCP 47 locale tag (e.g. "en-US"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns ""
 * @param options optional setting for the form of the name
 * @returns localized zone name, or "" on invalid input
 *
 * @example formatTimeZoneName("America/New_York", "en-US", { style: "shortGeneric" }) // "ET"
 * @example formatTimeZoneName("America/New_York", "en-US", { style: "longGeneric" }) // "Eastern Time"
 * @example formatTimeZoneName("America/New_York", "en-US", { style: "shortOffset" }) // "GMT-4" or "GMT-5", depending on the current date
 * @example formatTimeZoneName("Asia/Tokyo", "ja-JP", { style: "longGeneric" }) // "日本標準時"
 * @example formatTimeZoneName("Invalid/Zone", "en-US") // ""
 * @example formatTimeZoneName("America/New_York", "!!!") // ""
 * @example formatTimeZoneName("Europe/Berlin", ["fr-FR", "en-US"], { style: "longGeneric" }) // "heure d’Europe centrale"
 */
export function formatTimeZoneName(
  timeZone: string,
  locale: string | string[],
  options?: FormatTimeZoneNameOptions,
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    if (!isValidTimeZone(timeZone)) {
      return "";
    }

    const resolvedLocale = resolveRequiredLocale(locale);
    if (resolvedLocale === null) return "";

    try {
      const style = optionOrDefault(options?.style, "long");
      const formatter = new Intl.DateTimeFormat(resolvedLocale, {
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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
