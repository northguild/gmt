// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { resolveUnixFormatReference } from "../../internal/unixFormatReference";
import { durationTotal } from "../../internal/zonedWallClockDifference";
import type { RelativeRoundingMethod, RelativeUnit } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";

export interface FormatRelativeUnixOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit | `${RelativeUnit}s`;
  roundingMethod?: RelativeRoundingMethod;
  epochUnit?: UnixUnit;
  reference?: string | number;
  timeZone?: string;
}

/**
 * Format the relative time between a unix epoch value and a reference instant.
 *
 * - Auto-picks the display unit based on the distance, unless `largestUnit` forces one: second
 *   under a minute, minute under an hour, hour under a day, then `formatRelativeDate`'s thresholds —
 *   day under 7 days, week under 28, month under 365, year beyond — so a 3-year distance reads
 *   "3 years ago".
 * - **Compatibility:** before 1.16.0 week, month and year were never auto-picked ("1,096 days ago").
 *   Pass `largestUnit: "day"` to keep a day count.
 * - `roundingMethod` controls how the distance rounds to the display unit.
 * - `timeZone` anchors a calendar unit (week, month or year, auto-picked or forced). Omitted, it is
 *   `"UTC"`, as in every `unix/` function; `"local"` is the system zone; an unknown zone returns
 *   `""` whatever the unit (ECMA-402 throws RangeError for it).
 * - `value` and a numeric `reference` are safe integers or strings of optionally negative ASCII
 *   digits; `largestUnit` and `epochUnit` accept singular or plural names.
 * - `options` must be an object or omitted: `null` returns `""`, as Temporal's GetOptionsObject
 *   rejects it.
 *
 * @param value unix epoch (string or number, per `epochUnit`) to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { style, numeric, largestUnit, roundingMethod, epochUnit, reference, timeZone }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds", reference: 1805358645000 }) // "3 years ago"
 * @example formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds", reference: 1805358645000, largestUnit: "day" }) // "1,096 days ago"
 * @example formatRelativeUnix(0, "en-US", { reference: 37800000, roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeUnix("0", "en-US", { reference: "1800", epochUnit: "second", largestUnit: "minutes" }) // "30 minutes ago"
 * @example formatRelativeUnix(0, "en-US", { reference: 1800000, timeZone: "Invalid/Zone" }) // ""
 * @example formatRelativeUnix(0, "en-US", null as never) // ""
 * @example formatRelativeUnix("not-a-number") // ""
 * @example formatRelativeUnix(1709163000000, ["fr-FR", "en-US"], { reference: 1709164800000 }) // "il y a 30 minutes"
 */
export function formatRelativeUnix(
  value: string | number,
  locale?: string | string[],
  options: FormatRelativeUnixOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: undefined is defaults (the parameter default); anything else that is
    // not an object, including null, is a TypeError.
    if (options === null || typeof options !== "object") return "";
    const epochUnit = resolveUnixEpochUnit(options.epochUnit);
    if (epochUnit === null) return "";
    const tz = normalizeTimeZone(options.timeZone);
    if (!tz) return "";

    const target = unixEpochToInstant(value, epochUnit);
    if (target === null) return "";

    const reference = resolveUnixFormatReference(options.reference, epochUnit);
    if (reference === null) return "";

    try {
      const diff = target.since(reference);
      // month/year are calendrical and need a relativeTo anchor.
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
