import { Temporal } from "@js-temporal/polyfill";
import { durationUntilString } from "../../internal";
import {
  isValidUnixEpochPair,
  resolveUnixTimeZone,
} from "../../internal/resolveUnixTimeZone";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";

/**
 * Return the difference between two Unix timestamps as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Uses Temporal.Instant.until() with `largestUnit` set to `unit`, then `.toString()`.
 * - Unlike `diffUnix`, `unit` is a single unit (not an array) — an ISO duration string
 *   already expresses a full multi-unit breakdown via `largestUnit` alone, so there's no
 *   array-of-units overload here.
 * - Returns `""` for invalid input (negative diffs are valid and render with a leading `-`).
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the
 * underlying difference before it's rendered, per Temporal's DifferenceOptions — same as
 * `diffUnix`. `toStringSmallestUnit`, `fractionalSecondDigits`, and `toStringRoundingMode`
 * control the precision of the rendered string itself, per Temporal's ToStringPrecisionOptions
 * (mirroring `parseDuration`'s options) — kept separate from the `.until()` rounding options
 * above because both option sets have colliding `smallestUnit`/`roundingMode` keys with
 * different Temporal types.
 *
 * @param value1 first Unix timestamp
 * @param value2 second Unix timestamp
 * @param unit DateTimeDurationUnit to use as the duration's largestUnit
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision)
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffUnixAsDuration(1706659200000, 1706745600000, "days") // "P1D"
 * @example diffUnixAsDuration(1706745600000, 1706659200000, "days") // "-P1D"
 * @example diffUnixAsDuration(1706659200, 1706745600, "days", { epochUnit: "seconds" }) // "P1D"
 * @example diffUnixAsDuration(NaN, 1706745600000, "days") // ""
 */
export function diffUnixAsDuration(
  value1: number,
  value2: number,
  unit: DateTimeDurationUnit,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  } & RoundingOptions<Temporal.DateTimeUnit> &
    DurationStringOptions,
): string {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = resolveUnixTimeZone(options?.timeZone);

  if (!timeZone) return "";

  const validUnit = isValidDateTimeDurationUnit(unit);

  if (!validUnit) {
    return "";
  }

  if (!isValidUnixEpochPair(value1, value2)) {
    return "";
  }

  try {
    const instant1 = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value1 * 1000 : value1,
    );
    const instant2 = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value2 * 1000 : value2,
    );

    const zdt1 = instant1.toZonedDateTimeISO(timeZone);
    const zdt2 = instant2.toZonedDateTimeISO(timeZone);

    return durationUntilString(zdt1, zdt2, unit, options);
  } catch {
    return "";
  }
}
