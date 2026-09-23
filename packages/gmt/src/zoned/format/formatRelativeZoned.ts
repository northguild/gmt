import { Temporal } from "@js-temporal/polyfill";
import { durationTotal, zonedDateTimeFrom } from "../../internal";
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import type { RelativeRoundingMethod, RelativeUnit } from "../../types";
import { isValidUtc } from "../../utc/validate";
import { isValidZonedFormatReference } from "../../internal/zonedFormatReference";
import { isValidZonedDateTime } from "../validate";

export interface FormatRelativeZonedOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  roundingMethod?: RelativeRoundingMethod;
  /**
   * Anchor point for the relative diff.
   *
   * - ZonedDateTime ISO string: kept in its own zone; Temporal handles
   *   cross-zone diffs correctly. The label is therefore zone-aware — a value
   *   and reference in different zones can produce a non-zero diff even when
   *   they describe the same absolute instant.
   * - UTC ISO string: placed into `value`'s timezone before diffing so the
   *   calendar anchor matches the value's wall clock.
   * - Numeric epoch (ms): same — placed into `value`'s timezone.
   * - Omitted: "now" in `value`'s own timezone.
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
 * - `roundingMethod` controls how the distance rounds to the display unit.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ZonedDateTime ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference }
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
