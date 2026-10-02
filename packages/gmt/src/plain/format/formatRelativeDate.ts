import { Temporal } from "@js-temporal/polyfill";
import {
  durationTotal,
  normalizeDateTime,
  resolveRelativeRounding,
} from "../../internal";
import type { RelativeDateUnit, RelativeTimeFormatOptions } from "../../types";
import { isValidDate } from "../validate";

/**
 * Options for `formatRelativeDate`: the reference date, the display unit, the rounding and the
 * wording.
 */
export interface FormatRelativeDateOptions extends RelativeTimeFormatOptions {
  /**
   * The unit the distance is written in, whatever its size, from `"day"` to `"year"`, singular or
   * plural. Omitted, the unit is picked from the distance: day under 7 days, week under 28, month
   * under 365 and year beyond.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: RelativeDateUnit | `${RelativeDateUnit}s`;
}

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
    if (options.reference !== undefined && !isValidDate(options.reference))
      return "";

    try {
      const target = Temporal.PlainDate.from(value);
      const reference = options.reference
        ? Temporal.PlainDate.from(options.reference)
        : Temporal.Now.plainDateISO();

      const diff = target.since(reference);
      const absDays = Math.abs(diff.total("day"));

      const unit =
        options.largestUnit === undefined
          ? (AUTO_UNITS.find((t) => absDays < t.maxDays)?.unit ?? "year")
          : options.largestUnit;

      let total: number;
      try {
        total = diff.total(unit);
      } catch {
        // month/year are calendrical and need a relativeTo anchor
        total = durationTotal(diff, unit, reference);
      }
      // Outside the retry: an invalid roundingMethod throws once, straight to the sentinel.
      const amount = resolveRelativeRounding(total, options.roundingMethod);

      return normalizeDateTime(
        new Intl.RelativeTimeFormat(locale, {
          numeric: options.numeric === undefined ? "auto" : options.numeric,
          style: options.style === undefined ? "long" : options.style,
        }).format(amount, unit),
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
