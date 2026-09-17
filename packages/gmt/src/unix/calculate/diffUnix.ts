import type { Temporal } from "@js-temporal/polyfill";
import { addToZoned, resolveDurationUnit, zonedUntil } from "../../internal";
import { differenceRecord } from "../../internal/differenceRecord";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two Unix timestamps measured in the given unit.
 *
 * - Uses Temporal.Instant.until() to calculate the difference.
 * - Supports single unit or array of units.
 * - Returns null for invalid input.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "hour", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest hour before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["days", "hours"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 * - With an array of units, the record is the whole difference: the largest listed unit is
 *   Temporal's `largestUnit`, and the amount of each unlisted unit between two listed units is
 *   carried into the next smaller listed unit, measured from the start moved by the larger listed
 *   amounts (so adding the record to the start reaches the end). Units smaller than the smallest
 *   listed unit are truncated, as for a single unit. For example, `["years", "days"]` over
 *   1 year 59 days returns `{ years: 1, days: 59 }`.
 *   Days carried into a time unit follow the wall clock of `timeZone` (a 23-hour DST day is
 *   23 hours).
 * - Each value is a safe integer or a digit string (`"1706659200000"`); anything else is invalid.
 * - An omitted `timeZone` is UTC; pass `"local"` for the system time zone. An unknown zone is
 *   invalid.
 * - Unit names may be singular or plural (`"day"` or `"days"`), as in Temporal; a record result
 *   keeps the plural keys.
 *
 * @param value1 first Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param value2 second Unix epoch, in the same form and unit
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"), smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls); a non-object value (such as `null`) is invalid
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffUnix(1706745600000, 1706659200000, "days", { timeZone: "UTC" }) // -1 (measured from the first value to the second)
 * @example diffUnix(1706745600, 1706659200, "days", { epochUnit: "seconds", timeZone: "UTC" }) // -1
 * @example diffUnix(0, -86400000, "days", { timeZone: "UTC" }) // -1 (1970-01-01 until 1969-12-31 is minus one day)
 * @example diffUnix(NaN, 0, "days") // null
 * @example diffUnix("0", "90000000", ["day", "hour"]) // { days: 1, hours: 1 } (digit strings, singular names with plural keys, UTC by default)
 * @example diffUnix(1704067200000, 1740787200000, ["years", "days"], { timeZone: "UTC" }) // { years: 1, days: 59 } (P1Y2M; the 2 months are carried into days)
 */
export function diffUnix(
  value1: number | string,
  value2: number | string,
  units:
    | DateTimeDurationUnit
    | Temporal.DateTimeUnit
    | Array<DateTimeDurationUnit | Temporal.DateTimeUnit>,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
  } & RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
  if (!isOptionsArgument(options)) {
    return null;
  }
  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const timeZone = normalizeTimeZone(options?.timeZone);

  if (!timeZone || epochUnit === null) return null;

  const requested: unknown[] = Array.isArray(units) ? units : [units];
  const plurals = requested.map((unit) =>
    typeof unit === "string" ? resolveDurationUnit(unit) : "",
  );

  if (!plurals.every(isValidDateTimeDurationUnit)) {
    return null;
  }

  const instant1 = unixEpochToInstant(value1, epochUnit);
  const instant2 = unixEpochToInstant(value2, epochUnit);

  if (instant1 === null || instant2 === null) {
    return null;
  }

  const largestUnit = getLargestDateTimeDurationUnit(plurals);
  if (largestUnit === "") return null;

  try {
    const duration = zonedUntil(
      instant1.toZonedDateTimeISO(timeZone),
      instant2.toZonedDateTimeISO(timeZone),
      {
        largestUnit,
        smallestUnit: options?.smallestUnit,
        roundingIncrement: options?.roundingIncrement,
        roundingMode: options?.roundingMode,
      },
    );

    if (!Array.isArray(units)) {
      return duration[plurals[0]] ?? 0;
    }

    // An unlisted unit between two listed units is carried into the next smaller listed unit.
    const start = instant1.toZonedDateTimeISO(timeZone);
    // Record keys are the plural names, as in every other diff family.
    return differenceRecord(start, duration, plurals, {
      add: (from, amount) => addToZoned(from, amount),
      until: (from, to, largest) =>
        zonedUntil(from, to, { largestUnit: largest as Temporal.DateTimeUnit }),
    });
  } catch {
    return null;
  }
}
