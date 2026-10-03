import { Temporal } from "@js-temporal/polyfill";
import { durationTotal } from "../../internal";
import { formatRelativeAmount } from "../../internal/formatRelativeDuration";
import type { RelativeDateUnit, RelativeTimeFormatOptions } from "../../types";
import { isValidDate } from "../validate";
import { resolveRelativeUnit } from "../../internal/resolveRelativeUnit";

/**
 * Options for `formatRelativeDate`: the reference date, the display unit, the rounding and the
 * wording.
 */
export interface FormatRelativeDateOptions extends RelativeTimeFormatOptions {
  /**
   * The unit the distance is written in, whatever its size: `"day"`, `"week"`, `"month"` or
   * `"year"`, singular or plural. Any other value returns `""`, a time unit such as `"hour"`
   * included: a date has no time, and Temporal throws RangeError for a unit outside the units of
   * the type. Omitted, the unit is picked from the distance: day under 7 days, week under 28,
   * month under 365 and year beyond.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: RelativeDateUnit | `${RelativeDateUnit}s`;
}

// Temporal's date unit group: the units a PlainDate difference may be written in.
const DATE_UNITS = [
  "year",
  "month",
  "week",
  "day",
] as const satisfies readonly RelativeDateUnit[];

const AUTO_UNITS: Array<{ unit: RelativeDateUnit; maxDays: number }> = [
  { unit: "day", maxDays: 7 },
  { unit: "week", maxDays: 28 },
  { unit: "month", maxDays: 365 },
  { unit: "year", maxDays: Infinity },
];

/**
 * Format the relative time between a plain date and a reference date.
 *
 * - Auto-picks the display unit (day/week/month/year) based on the distance, unless
 *   `largestUnit` forces one.
 * - `largestUnit` is one of those four units, singular or plural. Any other value returns `""`.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ISO date string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options How the distance is measured, rounded and worded
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeDate("2026-01-15", "en-US", { reference: "2026-04-15" }) // "3 months ago"
 * @example formatRelativeDate("2026-03-01", "en-US", { reference: "2026-03-11", largestUnit: "week", roundingMethod: "floor" }) // "2 weeks ago" (−1.43 weeks floors to −2; the default rounds to "last week")
 * @example formatRelativeDate("not-a-date") // ""
 * @example formatRelativeDate("2024-01-15", ["fr-FR", "en-US"], { reference: "2024-03-15" }) // "il y a 2 mois"
 * @example formatRelativeDate("2024-03-12", "en-US", null as never) // "" (null options)
 */
export function formatRelativeDate(
  value: string,
  locale?: string | string[],
  options: FormatRelativeDateOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
    // invalid input.
    if (options === null || typeof options !== "object") return "";
    if (!isValidDate(value)) return "";
    // Each option is read once (GetOption).
    const referenceOption = options.reference;
    if (referenceOption !== undefined && !isValidDate(referenceOption))
      return "";

    try {
      const forcedUnit = resolveRelativeUnit(options.largestUnit, DATE_UNITS);
      const roundingMethod = options.roundingMethod;
      const target = Temporal.PlainDate.from(value);
      const reference = referenceOption
        ? Temporal.PlainDate.from(referenceOption)
        : Temporal.Now.plainDateISO();

      const diff = target.since(reference);
      const absDays = Math.abs(diff.total("day"));

      const unit =
        forcedUnit === undefined
          ? (AUTO_UNITS.find((t) => absDays < t.maxDays)?.unit ?? "year")
          : forcedUnit;

      let total: number;
      try {
        total = diff.total(unit);
      } catch {
        // month/year are calendrical and need a relativeTo anchor
        total = durationTotal(diff, unit, reference);
      }
      // Outside the retry: an invalid roundingMethod throws once, straight to the sentinel.
      return formatRelativeAmount(total, unit, locale, options, roundingMethod);
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
