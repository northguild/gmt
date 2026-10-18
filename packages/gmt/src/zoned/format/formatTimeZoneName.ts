import { cachedFormatter } from "../../internal/formatterCache";
import { Temporal } from "../../internal/temporal";
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
 * | Member | Example (Australia/Sydney, en-AU) | Description |
 * | --- | --- | --- |
 * | `short` | `AEST`/`AEDT` | Abbreviated zone name; seasonal for DST zones. |
 * | `long` | `Australian Eastern Standard Time` | Full zone name; seasonal for DST zones. |
 * | `shortOffset` | `GMT+10` | Short UTC offset; seasonal. |
 * | `longOffset` | `GMT+10:00` | Zero-padded UTC offset; seasonal. |
 * | `shortGeneric` | `AET` | Season-independent generic abbreviation. |
 * | `longGeneric` | `Australian Eastern Time` | Season-independent generic full name. |
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
 *   value: "short" (AEST), "long" (Australian Eastern Standard Time),
 *   "shortOffset" (GMT+10), "longOffset" (GMT+10:00), "shortGeneric" (AET),
 *   "longGeneric" (Australian Eastern Time).
 * - "short"/"long"/"shortOffset"/"longOffset" name the zone's *current*
 *   offset — for a DST-observing zone the label flips between standard and
 *   daylight names depending on when this is called, since there's no
 *   instant parameter to pin it to (this matches how
 *   `Intl.DateTimeFormat.prototype.format()` itself defaults to "now" when
 *   called with no argument). "shortGeneric"/"longGeneric" are
 *   season-independent (e.g. "AET", "Australian Eastern Time") and don't have this
 *   issue — prefer them for a name that won't change twice a year.
 * - Output depends on runtime ICU data.
 * - Returns "" for an invalid timeZone or locale.
 * - An offset with seconds (`-00:44:30`) returns `""`. `Intl.DateTimeFormat` takes a time zone
 *   identifier only: constructing one with an offset that has seconds throws (ECMA-402, the
 *   `DateTimeFormat` construction step "If parseResult contains more than one MinuteSecond Parse
 *   Node, throw a RangeError exception"). Pass the IANA name.
 *
 * @param timeZone IANA name or a UTC offset to the minute (what `isValidTimeZone` accepts)
 * @param locale BCP 47 locale tag (e.g. "en-AU", "ja-JP"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns ""
 * @param options optional setting for the form of the name
 * @returns localized zone name, or "" on invalid input
 *
 * @example formatTimeZoneName("Australia/Sydney", "en-AU", { style: "shortGeneric" }) // "AET"
 * @example formatTimeZoneName("Australia/Sydney", "en-AU", { style: "longGeneric" }) // "Australian Eastern Time"
 * @example formatTimeZoneName("Australia/Sydney", "en-AU", { style: "shortOffset" }) // "GMT+10" or "GMT+11", depending on the current date
 * @example formatTimeZoneName("Asia/Tokyo", "ja-JP", { style: "longGeneric" }) // "日本標準時"
 * @example formatTimeZoneName("Invalid/Zone", "en-GB") // ""
 * @example formatTimeZoneName("Australia/Sydney", "!!!") // ""
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
      const formatter = cachedFormatter("DateTimeFormat", resolvedLocale, {
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
