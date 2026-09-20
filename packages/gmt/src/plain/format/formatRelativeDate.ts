import { Temporal } from "@js-temporal/polyfill";
import {
  durationTotal,
  normalizeDateTime,
  resolveRelativeRounding,
} from "../../internal";
import type { RelativeDateUnit, RelativeTimeFormatOptions } from "../../types";
import { isValidDate } from "../validate";

export interface FormatRelativeDateOptions extends RelativeTimeFormatOptions {
  largestUnit?: RelativeDateUnit;
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
 * - `roundingMethod` controls how the distance rounds to the display unit.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ISO date string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference }
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

    let amount: number;
    try {
      amount = resolveRelativeRounding(
        diff.total(unit),
        options.roundingMethod,
      );
    } catch {
      // month/year are calendrical and need a relativeTo anchor
      amount = resolveRelativeRounding(
        durationTotal(diff, unit, reference),
        options.roundingMethod,
      );
    }

    return normalizeDateTime(
      new Intl.RelativeTimeFormat(locale, {
        numeric: options.numeric === undefined ? "auto" : options.numeric,
        style: options.style === undefined ? "long" : options.style,
      }).format(amount, unit),
    );
  } catch {
    return "";
  }
}
