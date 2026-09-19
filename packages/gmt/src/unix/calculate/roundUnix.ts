import type { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import {
  isObject,
  resolveDateTimeUnit,
  roundZonedDateTime,
} from "../../internal";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  toUnixEpoch,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";

const ZONED_ROUNDING_UNITS: readonly unknown[] = [
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

function isZonedRoundingUnit(unit: unknown): unit is "day" | Temporal.TimeUnit {
  return ZONED_ROUNDING_UNITS.includes(unit);
}

/**
 * Round a Unix timestamp to the specified unit.
 *
 * - Converts to ZonedDateTime, rounds, converts back to epoch.
 * - Supports: "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Each unit is accepted in its singular or plural form ("hour" or "hours"), as Temporal's
 *   GetTemporalUnitValuedOption accepts both (§13.17).
 * - Date units ("year", "month", "week", in either form) return null: Temporal's
 *   ZonedDateTime.prototype.round accepts no unit larger than "day".
 * - Follows TC39 `ZonedDateTime.round`, which rounds the wall clock and re-resolves it in the
 *   zone. Across a transition the result can land after the input — in `Pacific/Chatham`,
 *   1727532300000 (03:50+13:45) truncated to the hour gives 1727532900000, 15 minutes later.
 *   Use `floorToZone` for a boundary that never exceeds the instant.
 * - `value` is a safe integer or a digit string (`"1706661000000"`); anything else returns null.
 * - An omitted `timeZone` is UTC; pass `"local"` for the system time zone. An unknown zone returns
 *   null.
 * - Returns null for invalid input.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param options Rounding options: smallestUnit, optional roundingIncrement, roundingMode, epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns Rounded Unix epoch number, or null on invalid input
 *
 * @example roundUnix(1706661000000, { smallestUnit: "hour", timeZone: "UTC" }) // 1706662800000 (00:30 is a tie; halfExpand rounds up)
 * @example roundUnix(1706700000, { smallestUnit: "day", epochUnit: "seconds", timeZone: "UTC" }) // 1706659200 (11:20 rounds down to the day)
 * @example roundUnix(1706659200000, { smallestUnit: "hour", roundingIncrement: 2, timeZone: "UTC" }) // 1706659200000 (00:00 is already a 2-hour mark)
 * @example roundUnix(-86400000, { smallestUnit: "day", timeZone: "UTC" }) // -86400000 (start of day for negative timestamp)
 * @example roundUnix(1727532300000, { smallestUnit: "hour", roundingMode: "trunc", timeZone: "Pacific/Chatham" }) // 1727532900000 (after the input — TC39 wall-clock rounding)
 * @example roundUnix(1715779905500, { smallestUnit: "minutes", timeZone: "UTC" }) // 1715779920000 (plural unit name; 13:31:45.5 rounds up to 13:32)
 * @example roundUnix("1706700000", { smallestUnit: "day", epochUnit: "second" }) // 1706659200 (digit string, singular epochUnit, UTC by default)
 * @example roundUnix("invalid", { smallestUnit: "hour" }) // null
 * @example roundUnix(NaN, { smallestUnit: "hour" }) // null
 */
export function roundUnix(
  value: number | string,
  options: {
    smallestUnit: Temporal.SmallestUnit<
      | "day"
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
    epochUnit?: UnixUnit;
    timeZone?: string;
  },
): number | null {
  if (!isObject(options)) return null;

  const { roundingIncrement, roundingMode } = options;
  const epochUnit = resolveUnixEpochUnit(options.epochUnit);
  const timeZone = normalizeTimeZone(options.timeZone);
  const smallestUnit: unknown =
    typeof options.smallestUnit === "string"
      ? resolveDateTimeUnit(options.smallestUnit)
      : options.smallestUnit;

  if (!timeZone || epochUnit === null || !isValidDateTimeUnit(smallestUnit)) {
    return null;
  }

  // Temporal ZonedDateTime.prototype.round: ValidateTemporalUnitValue(smallestUnit, ~time~, « day »)
  if (!isZonedRoundingUnit(smallestUnit)) {
    return null;
  }

  const instant = unixEpochToInstant(value, epochUnit);

  if (instant === null) {
    return null;
  }

  try {
    const result = roundZonedDateTime(instant.toZonedDateTimeISO(timeZone), {
      smallestUnit,
      roundingIncrement,
      roundingMode,
    });

    return toUnixEpoch(result, epochUnit);
  } catch {
    return null;
  }
}
