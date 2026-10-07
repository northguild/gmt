import { Temporal } from "@js-temporal/polyfill";
import { formatRelativeAmount } from "../../internal/formatRelativeDuration";
import type { RelativeTimeFormatOptions, RelativeTimeUnit } from "../../types";
import { isValidTime } from "../validate";
import { resolveRelativeUnit } from "../../internal/resolveRelativeUnit";
import { isObject } from "../../internal/isObject";

/**
 * Options for `formatRelativeTime`: the reference time, the display unit, the rounding and the
 * wording.
 */
export interface FormatRelativeTimeOptions extends RelativeTimeFormatOptions {
  /**
   * The unit the distance is written in, whatever its size: `"second"`, `"minute"` or `"hour"`,
   * singular or plural. Any other value returns `""`, a date unit such as `"day"` included: a time
   * has no date, and Temporal throws RangeError for a unit outside the units of the type. Omitted,
   * the unit is picked from the distance: second under a minute, minute under an hour and hour
   * beyond.
   *
   * @defaultValue None. The unit is picked from the distance.
   */
  largestUnit?: RelativeTimeUnit | `${RelativeTimeUnit}s`;
}

// Temporal's time unit group down to the second: the units a PlainTime difference may be written
// in, less the sub-second units, which Intl.RelativeTimeFormat does not have.
const TIME_UNITS = [
  "hour",
  "minute",
  "second",
] as const satisfies readonly RelativeTimeUnit[];

const AUTO_UNITS: Array<{ unit: RelativeTimeUnit; maxSeconds: number }> = [
  { unit: "second", maxSeconds: 60 },
  { unit: "minute", maxSeconds: 3_600 },
  { unit: "hour", maxSeconds: Infinity },
];

/**
 * Format the relative time between a plain time and a reference time.
 *
 * - Auto-picks the display unit (second/minute/hour) based on the distance, unless
 *   `largestUnit` forces one.
 * - `largestUnit` is one of those three units, singular or plural. Any other value returns `""`.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ISO time string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options How the distance is measured, rounded and worded
 * @returns the formatted relative-time string, or "" on invalid input
 *
 * @example formatRelativeTime("14:30:00", "en-US", { style: "short", reference: "16:30:00" }) // "2 hr. ago"
 * @example formatRelativeTime("09:00:00", "en-US", { reference: "10:30:00", roundingMethod: "floor" }) // "2 hours ago" (−1.5 hours floors to −2)
 * @example formatRelativeTime("not-a-time") // ""
 * @example formatRelativeTime("10:00:00", ["fr-FR", "en-US"], { reference: "12:00:00" }) // "il y a 2 heures"
 * @example formatRelativeTime("10:00:00", "en-US", null as never) // "" (null options)
 */
export function formatRelativeTime(
  value: string,
  locale?: string | string[],
  options: FormatRelativeTimeOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
    // invalid input.
    if (!isObject(options)) return "";
    if (!isValidTime(value)) return "";
    // Each option is read once (GetOption).
    const referenceOption = options.reference;
    if (referenceOption !== undefined && !isValidTime(referenceOption))
      return "";

    try {
      const forcedUnit = resolveRelativeUnit(options.largestUnit, TIME_UNITS);
      const roundingMethod = options.roundingMethod;
      const target = Temporal.PlainTime.from(value);
      const reference = referenceOption
        ? Temporal.PlainTime.from(referenceOption)
        : Temporal.Now.plainTimeISO();

      const diff = target.since(reference);
      const absSeconds = Math.abs(diff.total("second"));

      const unit =
        forcedUnit === undefined
          ? (AUTO_UNITS.find((t) => absSeconds < t.maxSeconds)?.unit ?? "hour")
          : forcedUnit;

      return formatRelativeAmount(
        diff.total(unit),
        unit,
        locale,
        options,
        roundingMethod,
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
