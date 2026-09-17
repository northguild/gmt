import { Temporal } from "@js-temporal/polyfill";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import { durationUntilString } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import { isValidUtc } from "../validate/isValidUtc";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two UTC datetimes as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Uses Temporal.Instant.until() with `largestUnit` set to `unit`, then `.toString()`.
 * - Unlike `diffUtc`, `unit` is a single unit (not an array) — an ISO duration string
 *   already expresses a full multi-unit breakdown via `largestUnit` alone, so there's no
 *   array-of-units overload here.
 * - Returns `""` for invalid input (negative diffs are valid and render with a leading `-`).
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the
 * underlying difference before it's rendered, per Temporal's DifferenceOptions — same as
 * `diffUtc`. `toStringSmallestUnit`, `fractionalSecondDigits`, and `toStringRoundingMode`
 * control the precision of the rendered string itself, per Temporal's ToStringPrecisionOptions
 * (mirroring `parseDuration`'s options) — kept separate from the `.until()` rounding options
 * above because both option sets have colliding `smallestUnit`/`roundingMode` keys with
 * different Temporal types.
 *
 * @param value1 UTC ISO datetime string (start)
 * @param value2 UTC ISO datetime string (end)
 * @param unit DateTimeDurationUnit to use as the duration's largestUnit
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision); a non-object value (such as `null`) is invalid
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffUtcAsDuration("2024-03-10T12:00:00Z", "2024-03-11T12:00:00Z", "hours") // "PT24H"
 * @example diffUtcAsDuration("2024-03-11T12:00:00Z", "2024-03-10T12:00:00Z", "hours") // "-PT24H"
 * @example diffUtcAsDuration("invalid", "2024-03-11T12:00:00Z", "hours") // ""
 */
export function diffUtcAsDuration(
  value1: string,
  value2: string,
  unit: DateTimeDurationUnit | Temporal.DateTimeUnit,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string {
  // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
  if (!isOptionsArgument(options)) {
    return "";
  }
  const validUtc1 = isValidUtc(value1);
  const validUtc2 = isValidUtc(value2);
  const resolvedUnit = resolveDurationUnit(unit);
  const validUnit = isValidDateTimeDurationUnit(resolvedUnit);

  if (!validUtc1 || !validUtc2 || !validUnit) {
    return "";
  }

  try {
    const instant1 = Temporal.Instant.from(value1);
    const instant2 = Temporal.Instant.from(value2);

    const zdt1 = instant1.toZonedDateTimeISO("UTC");
    const zdt2 = instant2.toZonedDateTimeISO("UTC");

    return durationUntilString(zdt1, zdt2, resolvedUnit, options);
  } catch {
    return "";
  }
}
