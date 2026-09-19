import type { Temporal } from "@js-temporal/polyfill";
import type {
  RelativeRoundingMethod,
  RelativeTimeFormatOptions,
  RelativeUnit,
} from "../types";
import { normalizeDateTime } from "./normalizeDateTime";
import { resolveRelativeRounding } from "./resolveRelativeRounding";

/** A relative unit, singular or plural (`Intl.RelativeTimeFormat` and Temporal accept both). */
type RelativeUnitName = RelativeUnit | `${RelativeUnit}s`;

/** The display fields every seven-unit `formatRelative*` function reads. */
export interface RelativeDurationFormatOptions {
  style?: RelativeTimeFormatOptions["style"];
  numeric?: RelativeTimeFormatOptions["numeric"];
  largestUnit?: RelativeUnitName;
  roundingMethod?: RelativeRoundingMethod;
}

// Seconds up to a day, then formatRelativeDate's day thresholds (7, 28 and 365 days).
const SECONDS_PER_DAY = 86_400;
const AUTO_UNITS: Array<{ unit: RelativeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: SECONDS_PER_DAY },
  { unit: "day", maxSeconds: 7 * SECONDS_PER_DAY },
  { unit: "week", maxSeconds: 28 * SECONDS_PER_DAY },
  { unit: "month", maxSeconds: 365 * SECONDS_PER_DAY },
  { unit: "year", maxSeconds: Infinity },
];

/**
 * Render a signed distance with `Intl.RelativeTimeFormat`, picking the unit from the distance when
 * `largestUnit` is omitted. The shared tail of the plain, utc, unix and zoned relative formatters.
 *
 * @param diff the signed distance (target since reference)
 * @param locale BCP 47 locale(s) passed through to `Intl.RelativeTimeFormat`
 * @param options display style, numeric mode, largest unit and rounding method
 * @param calendarTotal the total in `unit` against the caller's anchor; called only when the unit
 *   is calendrical (month, year) and `diff.total(unit)` throws without a `relativeTo`
 * @returns the formatted phrase; throws where `Intl` or Temporal throws, for the caller's sentinel
 * @example formatRelativeDuration(Temporal.Duration.from({ minutes: -30 }), "en-US", {}, () => 0) // "30 minutes ago"
 * @example formatRelativeDuration(Temporal.Duration.from({ hours: 36 }), "en-US", { largestUnit: "hour" }, () => 0) // "in 36 hours"
 * @example formatRelativeDuration(Temporal.Duration.from({ days: 400 }), "en-US", {}, () => 1) // "next year" (month/year totals come from calendarTotal)
 */
export function formatRelativeDuration(
  diff: Temporal.Duration,
  locale: string | string[] | undefined,
  options: RelativeDurationFormatOptions,
  calendarTotal: (unit: RelativeUnitName) => number,
): string {
  const absSeconds = Math.abs(diff.total("second"));

  const unit =
    options.largestUnit ??
    AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ??
    "year";

  let amount: number;
  try {
    amount = resolveRelativeRounding(diff.total(unit), options.roundingMethod);
  } catch {
    // month/year are calendrical and need a relativeTo anchor.
    amount = resolveRelativeRounding(
      calendarTotal(unit),
      options.roundingMethod,
    );
  }

  return normalizeDateTime(
    new Intl.RelativeTimeFormat(locale, {
      numeric: options.numeric ?? "auto",
      style: options.style ?? "long",
    }).format(amount, unit),
  );
}
