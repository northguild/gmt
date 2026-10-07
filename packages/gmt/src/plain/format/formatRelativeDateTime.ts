// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { durationTotal } from "../../internal";
import { formatRelativeDuration } from "../../internal/formatRelativeDuration";
import type {
  RelativeDateTimeUnit,
  RelativeTimeFormatOptions,
} from "../../types";
import { isValidDateTime } from "../validate";
import { isObject } from "../../internal/isObject";

/**
 * Options for `formatRelativeDateTime`: the reference date-time, the display unit, the rounding
 * and the wording.
 */
export interface FormatRelativeDateTimeOptions extends RelativeTimeFormatOptions {
  /**
   * The unit the distance is written in, whatever its size: `"second"`, `"minute"`, `"hour"`,
   * `"day"`, `"week"`, `"month"` or `"year"`, singular or plural. Any other value returns `""`.
   * Omitted, the unit is picked from the distance: second under a minute, minute under an hour,
   * hour under a day, day under 7 days, week under 28, month under 365 and year beyond.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: RelativeDateTimeUnit | `${RelativeDateTimeUnit}s`;
}

/**
 * Format the relative time between a plain date-time and a reference date-time.
 *
 * - Auto-picks the display unit based on the distance, unless `largestUnit` forces one: second
 *   under a minute, minute under an hour, hour under a day, then `formatRelativeDate`'s thresholds —
 *   day under 7 days, week under 28, month under 365, year beyond — so a 3-year distance reads
 *   "3 years ago".
 * - **Compatibility:** before 1.16.0 week, month and year were never auto-picked ("1,096 days ago").
 *   Pass `largestUnit: "day"` to keep a day count.
 * - `largestUnit` is one of the seven units from `"second"` to `"year"`, singular or plural. Any
 *   other value returns `""`.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ISO date-time string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options How the distance is measured, rounded and worded
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeDateTime("2026-03-17T09:00:00", "en-GB", { style: "long", reference: "2026-03-17T06:00:00" }) // "in 3 hours"
 * @example formatRelativeDateTime("2026-01-15T00:00:00", "en-US", { reference: "2026-01-15T10:30:00", roundingMethod: "floor" }) // "11 hours ago" (−10.5 hours floors to −11; the default rounds to 10)
 * @example formatRelativeDateTime("2021-03-15T12:00:00", "en-US", { reference: "2024-03-15T12:00:00" }) // "3 years ago"
 * @example formatRelativeDateTime("not-a-date") // ""
 * @example formatRelativeDateTime("2024-03-15T09:00:00", ["fr-FR", "en-US"], { reference: "2024-03-15T12:00:00" }) // "il y a 3 heures"
 * @example formatRelativeDateTime("2024-03-12T10:00:00", "en-US", null as never) // "" (null options)
 */
export function formatRelativeDateTime(
  value: string,
  locale?: string | string[],
  options: FormatRelativeDateTimeOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
    // invalid input.
    if (!isObject(options)) return "";
    if (!isValidDateTime(value)) return "";
    // Each option is read once (GetOption).
    const referenceOption = options.reference;
    if (referenceOption !== undefined && !isValidDateTime(referenceOption))
      return "";

    try {
      const target = Temporal.PlainDateTime.from(value);
      const reference = referenceOption
        ? Temporal.PlainDateTime.from(referenceOption)
        : Temporal.Now.plainDateTimeISO();

      const diff = target.since(reference);
      // month/year are calendrical — relativeTo needs a PlainDate
      return formatRelativeDuration(diff, locale, options, (unit) =>
        durationTotal(diff, unit, reference.toPlainDate()),
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
