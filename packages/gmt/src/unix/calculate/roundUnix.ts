import type { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import {
  frameInstant,
  frameZoned,
  isObject,
  normalizeZoneFrame,
  resolveDateTimeUnit,
  roundZonedDateTime,
} from "../../internal";
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
 * - Returns null for invalid input.
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `null`. An offset to the minute has no
 *   such limit.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param options rounding settings: the unit to round to, how to round, and how `value` is read
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
    /**
     * The unit to round to, from `"day"` down to `"nanosecond"`, singular or plural. A larger unit
     * returns `null`, as `Temporal.ZonedDateTime.prototype.round` accepts none above `"day"`.
     */
    smallestUnit: Temporal.SmallestUnit<
      | "day"
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >;
    /**
     * The number of `smallestUnit` steps to round to, such as `15` with `"minute"` for quarter
     * hours. It must divide the next larger unit evenly and be smaller than it, and must be `1` for
     * `"day"`; any other value returns `null`. A non-integer is truncated first, as Temporal does.
     *
     * @defaultValue `1`, Temporal's default.
     */
    roundingIncrement?: number;
    /**
     * The step a value between two steps is rounded to. `"halfExpand"` picks the nearer step and
     * sends a tie to the later one; `"floor"` and `"trunc"` pick the earlier step, `"ceil"` and
     * `"expand"` the later, and the other `"half…"` modes differ only in how a tie breaks.
     *
     * @defaultValue `"halfExpand"`, Temporal's default.
     */
    roundingMode?: Temporal.RoundingMode;
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `null`. The result is in the same unit.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the wall clock is rounded in: an IANA name, a UTC offset (a time zone
     * identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
     * `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): number | null {
  try {
    if (!isObject(options)) return null;

    const { roundingIncrement, roundingMode } = options;
    const epochUnit = resolveUnixEpochUnit(options.epochUnit);
    const frame = normalizeZoneFrame(options.timeZone);
    // One read (GetOption): resolveDateTimeUnit returns a value that is not a string unchanged.
    const smallestUnit: unknown = resolveDateTimeUnit(
      options.smallestUnit as unknown,
    );

    if (
      frame === null ||
      epochUnit === null ||
      !isValidDateTimeUnit(smallestUnit)
    ) {
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
      const result = roundZonedDateTime(frameZoned(instant, frame), {
        smallestUnit,
        roundingIncrement,
        roundingMode,
      });

      return toUnixEpoch(frameInstant(result, frame), epochUnit);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
