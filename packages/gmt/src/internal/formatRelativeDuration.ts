import type { Temporal } from "@js-temporal/polyfill";
import type {
  RelativeRoundingMethod,
  RelativeTimeFormatOptions,
  RelativeUnit,
} from "../types";
import { normalizeDateTime } from "./normalizeDateTime";
import { resolveRelativeRounding } from "./resolveRelativeRounding";
import { optionOrDefault } from "./optionOrDefault";
import { resolveRelativeUnit } from "./resolveRelativeUnit";

/** A relative unit, singular or plural (`Intl.RelativeTimeFormat` and Temporal accept both). */
type RelativeUnitName = RelativeUnit | `${RelativeUnit}s`;

/** The display fields every seven-unit `formatRelative*` function reads. */
export interface RelativeDurationFormatOptions {
  style?: RelativeTimeFormatOptions["style"];
  numeric?: RelativeTimeFormatOptions["numeric"];
  largestUnit?: RelativeUnitName;
  roundingMethod?: RelativeRoundingMethod;
}

// The units of the seven-unit functions: Temporal's datetime unit group down to the second, less
// the sub-second units, which Intl.RelativeTimeFormat does not have.
const RELATIVE_UNITS = [
  "year",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
] as const satisfies readonly RelativeUnit[];

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
  calendarTotal: (unit: RelativeUnit) => number,
): string {
  // Each option is read once (GetOption), and largestUnit is validated before anything is measured.
  const forcedUnit = resolveRelativeUnit(options.largestUnit, RELATIVE_UNITS);
  const roundingMethod = options.roundingMethod;
  const absSeconds = Math.abs(diff.total("second"));

  const unit =
    forcedUnit === undefined
      ? (AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ?? "year")
      : forcedUnit;

  let total: number;
  try {
    total = diff.total(unit);
  } catch {
    // month/year are calendrical and need a relativeTo anchor.
    total = calendarTotal(unit);
  }
  // Outside the retry: an invalid roundingMethod throws once, straight to the caller's sentinel.
  return formatRelativeAmount(total, unit, locale, options, roundingMethod);
}

/**
 * Round a distance to a whole number of `unit` and render it with `Intl.RelativeTimeFormat`. The
 * shared last step of every `formatRelative*` function.
 *
 * - `numeric` and `style` are read here, once each (GetOption); `roundingMethod` is passed in
 *   because the caller has already read it.
 *
 * @param total the signed fractional distance in `unit`
 * @param unit the singular unit the distance is written in
 * @param locale BCP 47 locale(s) passed through to `Intl.RelativeTimeFormat`
 * @param options the caller's options, read for `numeric` (default `"auto"`) and `style`
 *   (default `"long"`)
 * @param roundingMethod the caller's `roundingMethod`, `undefined` for the default `"round"`
 * @returns the formatted phrase; throws where `Intl` throws or the rounding method is invalid, for
 *   the caller's sentinel
 * @example formatRelativeAmount(-1.5, "hour", "en-US", {}, "floor") // "2 hours ago"
 * @example formatRelativeAmount(1, "day", "en-US", { numeric: "always" }, undefined) // "in 1 day"
 * @example formatRelativeAmount(1, "day", "en-US", { style: "wide" as never }, undefined) // throws RangeError
 */
export function formatRelativeAmount(
  total: number,
  unit: RelativeUnit,
  locale: string | string[] | undefined,
  options: Pick<RelativeDurationFormatOptions, "numeric" | "style">,
  roundingMethod: RelativeRoundingMethod | undefined,
): string {
  const amount = resolveRelativeRounding(total, roundingMethod);

  return normalizeDateTime(
    new Intl.RelativeTimeFormat(locale, {
      numeric: optionOrDefault(options.numeric, "auto"),
      style: optionOrDefault(options.style, "long"),
    }).format(amount, unit),
  );
}
