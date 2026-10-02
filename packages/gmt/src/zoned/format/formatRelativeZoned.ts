import { Temporal } from "@js-temporal/polyfill";
import { durationTotal, zonedDateTimeFrom } from "../../internal";
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import type { RelativeRoundingMethod, RelativeUnit } from "../../types";
import { isValidUtc } from "../../utc/validate";
import { isValidZonedFormatReference } from "../../internal/zonedFormatReference";
import { isValidZonedDateTime } from "../validate";

/**
 * Options for `formatRelativeZoned`: how the phrase is worded, the unit it counts in, how the
 * count rounds and the moment the distance is measured from.
 */
export interface FormatRelativeZonedOptions {
  /**
   * The length of the unit name, as the `style` of `Intl.RelativeTimeFormat`: `"long"` ("in 3
   * months"), `"short"` ("in 3 mo.") or `"narrow"` (the locale's most compact form).
   *
   * @defaultValue `"long"`
   */
  style?: "long" | "short" | "narrow";
  /**
   * Whether a distance may be written as a word instead of a number, as the `numeric` option of
   * `Intl.RelativeTimeFormat`. `"auto"` uses the locale's word where it has one ("yesterday", "next
   * year"); `"always"` writes the number every time ("1 day ago").
   *
   * @defaultValue `"auto"`
   */
  numeric?: "always" | "auto";
  /**
   * The unit the distance is written in, whatever its size, from `"second"` to `"year"`, singular
   * or plural. Omitted, the unit is picked from the distance: second under a minute, minute under
   * an hour, hour under a day, day under 7 days, week under 28, month under 365 and year beyond.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: RelativeUnit | `${RelativeUnit}s`;
  /**
   * The way a fractional distance becomes the whole number displayed: `"round"` goes to the nearest
   * whole number, `"floor"` down and `"ceil"` up. It applies to the signed value, where a past
   * distance is negative, so `"floor"` turns −1.5 hours into "2 hours ago".
   *
   * @defaultValue `"round"`
   */
  roundingMethod?: RelativeRoundingMethod;
  /**
   * The instant the distance is measured from, as a zoned ISO string, a UTC ISO string or a numeric
   * epoch in milliseconds. The distance is the exact time between the two instants; the reference's
   * time zone only anchors how months and years are counted, which is its own zone for a zoned
   * string and `value`'s zone for a UTC string or an epoch. Any other value returns `""`.
   *
   * @defaultValue The current instant, read in `value`'s time zone.
   */
  reference?: string | number;
}

/**
 * Format the relative time between a zoned date-time and a reference instant.
 *
 * - Auto-picks the display unit based on the distance, unless `largestUnit` forces one: second
 *   under a minute, minute under an hour, hour under a day, then `formatRelativeDate`'s thresholds —
 *   day under 7 days, week under 28, month under 365, year beyond — so a 3-year distance reads
 *   "3 years ago".
 * - **Compatibility:** before 1.16.0 week, month and year were never auto-picked ("1,096 days ago").
 *   Pass `largestUnit: "day"` to keep a day count.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ZonedDateTime ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional settings for the wording, the display unit, rounding and the reference moment
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeZoned("2023-12-29T00:00:00+00:00[UTC]", "en-US", { reference: "2024-02-29T00:00:00+00:00[UTC]" }) // "2 months ago"
 * @example formatRelativeZoned("2026-03-08T01:00:00-05:00[America/New_York]", "en-US", { reference: "2026-03-07T01:00:00-05:00[America/New_York]" }) // "tomorrow"
 * @example formatRelativeZoned("2026-01-15T00:00:00+00:00[UTC]", "en-US", { reference: "2026-01-15T10:30:00+00:00[UTC]", roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeZoned("not-a-date") // ""
 * @example formatRelativeZoned("2024-02-28T23:30:00+00:00[UTC]", ["fr-FR", "en-US"], { reference: "2024-02-29T00:00:00+00:00[UTC]" }) // "il y a 30 minutes"
 * @example formatRelativeZoned("2024-03-12T10:00:00-04:00[America/New_York]", "en-US", null as never) // "" (null options)
 */
export function formatRelativeZoned(
  value: string,
  locale?: string | string[],
  options: FormatRelativeZonedOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
    // invalid input.
    if (options === null || typeof options !== "object") return "";
    if (!isValidZonedDateTime(value)) return "";

    if (!isValidZonedFormatReference(options.reference)) return "";

    try {
      const valueZDT = zonedDateTimeFrom(value);
      const valueInstant = valueZDT.toInstant();

      const refZDT = resolveZonedReference(
        options.reference,
        valueZDT.timeZoneId,
      );

      const diff = valueInstant.since(refZDT.toInstant());
      // month/year are calendrical and need a relativeTo anchor
      return formatRelativeDuration(diff, locale, options, (unit) =>
        durationTotal(diff, unit, refZDT),
      );
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}

/**
 * The reference as a zoned date-time: now or a UTC string or epoch placed into `timeZoneId`, or a
 * zoned string kept in its own zone. Throws where Temporal throws.
 */
function resolveZonedReference(
  reference: string | number | undefined,
  timeZoneId: string,
): Temporal.ZonedDateTime {
  if (reference === undefined) {
    // "now" in value's own zone — keeps the calendar context consistent.
    return Temporal.Now.zonedDateTimeISO(timeZoneId);
  }
  if (typeof reference === "string") {
    // UTC string → place into value's zone for a consistent calendar anchor.
    // ZonedDateTime string → keep its own zone; Temporal handles cross-zone diffs.
    // isValidUtc covers both `Z` and `z` suffixes (the regex accepts [Zz]).
    return isValidUtc(reference)
      ? Temporal.Instant.from(reference).toZonedDateTimeISO(timeZoneId)
      : zonedDateTimeFrom(reference);
  }
  // Numeric epoch (ms) → place into value's zone.
  return Temporal.Instant.fromEpochMilliseconds(reference).toZonedDateTimeISO(
    timeZoneId,
  );
}
