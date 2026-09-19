import type { Temporal } from "@js-temporal/polyfill";
import {
  durationUntilString,
  parseCalendarDatePairForArithmetic,
} from "../../internal";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import type {
  DateDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import { isValidCalendarDate, isValidDateDurationUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two PlainDate values as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Returns `""` for invalid inputs (negative diffs are valid and render with a leading `-`).
 * - Uses Temporal's `until` semantics with `largestUnit` set to `unit` (TC39 CalendarDateUntil; for
 *   non-ISO calendars the Intl era/monthCode proposal's NonISODateUntil), then `.toString()`.
 * - Accepts RFC 9557 calendar-annotated PlainDate strings. Same calendar rule as `diffDate` (see
 *   its JSDoc): measured in the shared calendar when `date1` and `date2` name the same calendar,
 *   `""` when they name different calendars (TC39 `CalendarEquals`; before 1.16.0 measured in ISO).
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
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param date1 ISO PlainDate string for the start, optionally calendar-annotated
 * @param date2 ISO PlainDate string for the end, optionally calendar-annotated
 * @param unit date unit, singular or plural (`"day"` or `"days"`), to use as the duration's largestUnit
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision); a non-object value (such as `null`) is invalid
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffDateAsDuration("2024-03-10", "2024-04-05", "days") // "P26D"
 * @example diffDateAsDuration("2024-01-01", "2023-01-01", "days") // "-P365D"
 * @example diffDateAsDuration("2024-01-01", "2024-01-01", "days") // "PT0S"
 * @example diffDateAsDuration("invalid", "2024-03-15", "days") // ""
 * @example diffDateAsDuration("2024-01-01", "2024-01-16", "weeks", { smallestUnit: "weeks", roundingMode: "halfExpand" }) // "P2W"
 * @example diffDateAsDuration("2024-02-24[u-ca=hebrew]", "2024-03-25[u-ca=hebrew]", "months") // "P1M" (measured in Hebrew, 15 Adar I -> 15 Adar II)
 * @example diffDateAsDuration("2023-08-31[u-ca=buddhist]", "2023-09-30[u-ca=buddhist]", "months") // "P30D" (Aug 31 + 1 month would pass Sep 30)
 */
export function diffDateAsDuration(
  date1: string,
  date2: string,
  unit: DateDurationUnit | Temporal.DateUnit,
  options?: RoundingOptions<Temporal.DateUnit> & DurationStringOptions,
): string {
  // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
  if (!isOptionsArgument(options)) {
    return "";
  }
  const validDates = isValidCalendarDate(date1) && isValidCalendarDate(date2);
  // Singular names resolve to their plural (Temporal §13.17).
  const resolvedUnit = resolveDurationUnit(unit);
  const validUnit = isValidDateDurationUnit(resolvedUnit);

  if (!validDates || !validUnit) {
    return "";
  }

  try {
    const { a: d1, b: d2 } = parseCalendarDatePairForArithmetic(date1, date2);

    return durationUntilString(d1, d2, resolvedUnit, options);
  } catch {
    return "";
  }
}
