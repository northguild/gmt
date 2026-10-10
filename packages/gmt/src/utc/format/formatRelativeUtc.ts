// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import { frameZoned, normalizeZoneFrame } from "../../internal/zoneFrame";
import {
  toInstantFromUtc,
  toReferenceInstantFromUtc,
} from "../../internal/toInstantFromUtc";
import { durationTotal } from "../../internal/zonedWallClockDifference";
import type { RelativeTimeFormatOptions, RelativeUnit } from "../../types";
import { isValidUtc } from "../validate";
import { isObject } from "../../internal/isObject";

/**
 * Options for `formatRelativeUtc`: the instant the distance is measured from, the unit it is shown
 * in, how it rounds, and the wording `Intl.RelativeTimeFormat` uses.
 */
export interface FormatRelativeUtcOptions extends RelativeTimeFormatOptions {
  /**
   * The unit the distance is written in, whatever its size: `"second"`, `"minute"`, `"hour"`,
   * `"day"`, `"week"`, `"month"` or `"year"`, singular or plural. Any other value returns `""`.
   * Omitted, the unit is picked from the distance: second under a minute, minute under an hour,
   * hour under a day, day under 7 days, week under 28, month under 365 and year beyond.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: RelativeUnit | `${RelativeUnit}s`;
  /**
   * The instant the distance is measured from, as a UTC ISO string. Any other value returns `""`.
   *
   * @defaultValue The current instant.
   */
  reference?: string;
  /**
   * The time zone that anchors a calendar unit (week, month or year): an IANA name, a UTC offset (a
   * time zone identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
   * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
   * `""` whatever the unit.
   *
   * @defaultValue `"UTC"`
   */
  timeZone?: string;
}

/**
 * Format the relative time between a UTC ISO string and a reference instant.
 *
 * - Picks the display unit from the distance, using `formatRelativeDate`'s day thresholds past a
 *   day, so a 3-year distance reads "3 years ago".
 * - **Compatibility:** before 1.16.0 week, month and year were never auto-picked ("1,096 days ago").
 *   Pass `largestUnit: "day"` to keep a day count.
 * - `largestUnit` is one of the seven units from `"second"` to `"year"`, singular or plural. Any
 *   other value returns `""`.
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 * - **Limit at an offset with seconds.** A month or a year is measured from `reference`, placed in
 *   the offset's whole-minute zone and moved by its seconds, and the moved instant must be inside
 *   Temporal's range. So when one is measured and `reference` is within the offset's seconds (under
 *   a minute) of the last instant Temporal supports (`+275760-09-13T00:00:00Z`) for an offset east
 *   of UTC, or of the first (`-271821-04-20T00:00:00Z`) for one west, this returns `""`. An offset
 *   to the minute has no such limit.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options The reference instant, the display unit, rounding, wording and time zone
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", { reference: "2026-04-15T14:30:45Z" }) // "3 months ago"
 * @example formatRelativeUtc("2026-01-15T00:00:00Z", "en-US", { reference: "2026-01-15T10:30:00Z", roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeUtc("2026-01-15T00:00:00Z", "en-US", { reference: "2026-01-15T00:30:00Z", timeZone: "Invalid/Zone" }) // ""
 * @example formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", null as never) // ""
 * @example formatRelativeUtc("not-a-date") // ""
 * @example formatRelativeUtc("2024-03-15T11:30:00Z", ["fr-FR", "en-US"], { reference: "2024-03-15T12:00:00Z" }) // "il y a 30 minutes"
 * @example formatRelativeUtc("1970-01-03T12:00:00Z", "en-US", { reference: "1970-01-01T12:00:00Z", timeZone: "-00:44:30" }) // "in 2 days" (a stored offset with seconds)
 */
export function formatRelativeUtc(
  value: string,
  locale?: string | string[],
  options: FormatRelativeUtcOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: undefined is defaults (the parameter default); anything else that is
    // not an object, including null, is a TypeError.
    if (!isObject(options)) return "";
    if (!isValidUtc(value)) return "";
    const frame = normalizeZoneFrame(options.timeZone);
    if (frame === null) return "";
    // Each option is read once (GetOption).
    const referenceOption = options.reference;
    if (referenceOption !== undefined && !isValidUtc(referenceOption))
      return "";

    const target = toInstantFromUtc(value);
    if (target === null) return "";

    const reference = toReferenceInstantFromUtc(referenceOption);
    if (reference === null) return "";

    try {
      const diff = target.since(reference);
      // Only a calendrical unit (month, year) reads the anchor, so the zone is applied lazily.
      return formatRelativeDuration(diff, locale, options, (unit) =>
        durationTotal(diff, unit, frameZoned(reference, frame)),
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
