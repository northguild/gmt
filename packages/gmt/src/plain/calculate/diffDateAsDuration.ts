import type { Temporal } from "@js-temporal/polyfill";
import { durationUntilString, parseCalendarDatePairForArithmetic } from "../../internal";
import type {
  DateDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import { isValidCalendarDate, isValidDateDurationUnit } from "../validate";

/**
 * Return the difference between two PlainDate values as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Returns `""` for invalid inputs (negative diffs are valid and render with a leading `-`).
 * - Uses Temporal.PlainDate.until with `largestUnit` set to `unit`, then `.toString()`.
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Same shared-vs-mismatched
 *   calendar rule as `diffDate` (see its JSDoc): measured in the shared calendar when `date1`
 *   and `date2` carry the same tag, Gregorian otherwise.
 * - Unlike `diffDate`, `unit` is a single unit (not an array) — an ISO duration string already
 *   expresses a full multi-unit breakdown via `largestUnit` alone, so there's no array-of-units
 *   overload here.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the
 * underlying difference before it's rendered, per Temporal's DifferenceOptions — same as `diffDate`.
 * `toStringSmallestUnit`, `fractionalSecondDigits`, and `toStringRoundingMode` control the
 * precision of the rendered string itself, per Temporal's ToStringPrecisionOptions (mirroring
 * `parseDuration`'s options) — kept separate from the `.until()` rounding options above because
 * both option sets have colliding `smallestUnit`/`roundingMode` keys with different Temporal types.
 *
 * @param date1 ISO PlainDate string for the start, optionally calendar-annotated
 * @param date2 ISO PlainDate string for the end, optionally calendar-annotated
 * @param unit DateDurationUnit to use as the duration's largestUnit
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision)
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffDateAsDuration("2024-03-10", "2024-04-05", "days") // "P26D"
 * @example diffDateAsDuration("2024-01-01", "2023-01-01", "days") // "-P365D"
 * @example diffDateAsDuration("2024-01-01", "2024-01-01", "days") // "PT0S"
 * @example diffDateAsDuration("invalid", "2024-03-15", "days") // ""
 * @example diffDateAsDuration("2024-01-01", "2024-01-16", "weeks", { smallestUnit: "weeks", roundingMode: "halfExpand" }) // "P2W"
 * @example diffDateAsDuration("5784-06-15[u-ca=hebrew]", "5784-07-15[u-ca=hebrew]", "months") // "P1M" (measured in Hebrew, Adar I -> Adar)
 */
export function diffDateAsDuration(
  date1: string,
  date2: string,
  unit: DateDurationUnit,
  options?: RoundingOptions<Temporal.DateUnit> & DurationStringOptions,
): string {
  const validDates = isValidCalendarDate(date1) && isValidCalendarDate(date2);
  const validUnit = isValidDateDurationUnit(unit);

  if (!validDates || !validUnit) {
    return "";
  }

  try {
    const { a: d1, b: d2 } = parseCalendarDatePairForArithmetic(
      date1,
      date2,
    );

    return durationUntilString(d1, d2, unit, options);
  } catch {
    return "";
  }
}
