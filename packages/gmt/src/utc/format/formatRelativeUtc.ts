// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  toInstantFromUtc,
  toReferenceInstantFromUtc,
} from "../../internal/toInstantFromUtc";
import { durationTotal } from "../../internal/zonedWallClockDifference";
import type { RelativeTimeFormatOptions, RelativeUnit } from "../../types";
import { isValidUtc } from "../validate";

export interface FormatRelativeUtcOptions extends RelativeTimeFormatOptions {
  largestUnit?: RelativeUnit;
  reference?: string;
  timeZone?: string;
}

/**
 * Format the relative time between a UTC ISO string and a reference instant.
 *
 * - Auto-picks the display unit based on the distance, unless `largestUnit` forces one: second
 *   under a minute, minute under an hour, hour under a day, then `formatRelativeDate`'s thresholds —
 *   day under 7 days, week under 28, month under 365, year beyond — so a 3-year distance reads
 *   "3 years ago".
 * - **Compatibility:** before 1.16.0 week, month and year were never auto-picked ("1,096 days ago").
 *   Pass `largestUnit: "day"` to keep a day count.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 * - `timeZone` anchors a calendar unit (week, month or year, auto-picked or forced). Omitted, it is
 *   `"UTC"`; pass `"local"` for the system time zone. An unknown zone returns `""` whatever the unit
 *   (ECMA-402 throws RangeError for it).
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference, timeZone }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", { reference: "2026-04-15T14:30:45Z" }) // "3 months ago"
 * @example formatRelativeUtc("2026-01-15T00:00:00Z", "en-US", { reference: "2026-01-15T10:30:00Z", roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeUtc("2026-01-15T00:00:00Z", "en-US", { reference: "2026-01-15T00:30:00Z", timeZone: "Invalid/Zone" }) // ""
 * @example formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", null as never) // ""
 * @example formatRelativeUtc("not-a-date") // ""
 * @example formatRelativeUtc("2024-03-15T11:30:00Z", ["fr-FR", "en-US"], { reference: "2024-03-15T12:00:00Z" }) // "il y a 30 minutes"
 */
export function formatRelativeUtc(
  value: string,
  locale?: string | string[],
  options: FormatRelativeUtcOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: undefined is defaults (the parameter default); anything else that is
    // not an object, including null, is a TypeError.
    if (options === null || typeof options !== "object") return "";
    if (!isValidUtc(value)) return "";
    const tz = normalizeTimeZone(options.timeZone);
    if (!tz) return "";
    if (options.reference !== undefined && !isValidUtc(options.reference))
      return "";

    const target = toInstantFromUtc(value);
    if (target === null) return "";

    const reference = toReferenceInstantFromUtc(options.reference);
    if (reference === null) return "";

    try {
      const diff = target.since(reference);
      // Only a calendrical unit (month, year) reads the anchor, so the zone is applied lazily.
      return formatRelativeDuration(diff, locale, options, (unit) =>
        durationTotal(diff, unit, reference.toZonedDateTimeISO(tz)),
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
