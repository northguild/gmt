import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime, resolveRelativeRounding } from "../../internal";
import type { RelativeRoundingMethod } from "../../types";
import { isValidDate } from "../validate";

// No "hour"/"minute"/"second" — PlainDate has no time component.
type RelativeUnit = "year" | "month" | "week" | "day";

export interface FormatRelativeDateOptions {
  style?: "long" | "short" | "narrow";
  numeric?: "always" | "auto";
  largestUnit?: RelativeUnit;
  /**
   * How the computed distance rounds to the display unit: "floor" rounds toward the
   * earlier boundary, "ceil" toward the later boundary, "round" (default) to the nearest —
   * matches current behavior when omitted.
   */
  roundingMethod?: RelativeRoundingMethod;
  reference?: string;
}

const AUTO_UNITS: Array<{ unit: RelativeUnit; maxDays: number }> = [
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
 *
 * @param value ISO date string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { style, numeric, largestUnit, roundingMethod, reference }
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeDate("2026-01-15", "en-US", { reference: "2026-04-15" }) // "3 months ago"
 * @example formatRelativeDate(value, "en-US", { roundingMethod: "floor" }) // rounds toward the earlier boundary
 * @example formatRelativeDate("not-a-date") // ""
 */
export function formatRelativeDate(
  value: string,
  locale?: string,
  options: FormatRelativeDateOptions = {},
): string {
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
      options.largestUnit ??
      AUTO_UNITS.find((t) => absDays < t.maxDays)?.unit ??
      "year";

    let amount: number;
    try {
      amount = resolveRelativeRounding(
        diff.total(unit),
        options.roundingMethod,
      );
    } catch {
      // month/year are calendrical and need a relativeTo anchor
      amount = resolveRelativeRounding(
        diff.total({ unit, relativeTo: reference }),
        options.roundingMethod,
      );
    }

    return normalizeDateTime(
      new Intl.RelativeTimeFormat(locale, {
        numeric: options.numeric ?? "auto",
        style: options.style ?? "long",
      }).format(amount, unit),
    );
  } catch {
    return "";
  }
}
