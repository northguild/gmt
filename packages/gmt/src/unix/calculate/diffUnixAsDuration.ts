import type { Temporal } from "@js-temporal/polyfill";
import {
  durationUntilString,
  frameZoned,
  normalizeZoneFrame,
  resolveDurationUnit,
} from "../../internal";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two Unix timestamps as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Converts both epochs to a `Temporal.ZonedDateTime` in `timeZone` and uses its `until()` with
 *   `largestUnit` set to `unit`, then `.toString()`. Calendar units (days, weeks, months, years)
 *   are therefore measured on that zone's wall clock — a 23-hour DST day is `P1D` — while time
 *   units are exact elapsed time. `Temporal.Instant.until()` is not used: it rejects every
 *   calendar `largestUnit`.
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
 * - Each value is a safe integer or a digit string (`"1706659200000"`); anything else is invalid.
 * - Unit names may be singular or plural (`"day"` or `"days"`), as in Temporal.
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `""`. An offset to the minute has no
 *   such limit.
 *
 * @param value1 first Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param value2 second Unix epoch, in the same form and unit
 * @param unit DateTimeDurationUnit to use as the duration's largestUnit
 * @param options optional: how the epochs are read, how the difference is rounded and how the string is rendered; a non-object value (such as `null`) is invalid
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffUnixAsDuration(1706659200000, 1706745600000, "days") // "P1D"
 * @example diffUnixAsDuration(1706745600000, 1706659200000, "days") // "-P1D"
 * @example diffUnixAsDuration(1706659200, 1706745600, "days", { epochUnit: "seconds" }) // "P1D"
 * @example diffUnixAsDuration("0", "90000000", "day") // "P1DT1H" (digit strings, singular unit, UTC by default)
 * @example diffUnixAsDuration(NaN, 1706745600000, "days") // ""
 */
export function diffUnixAsDuration(
  value1: number | string,
  value2: number | string,
  unit: DateTimeDurationUnit | Temporal.DateTimeUnit,
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `""`.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone calendar units are measured in: an IANA name, a UTC offset (a time zone
     * identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
     * `""`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  } & RoundingOptions<Temporal.DateTimeUnit> &
    DurationStringOptions,
): string {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(options)) {
      return "";
    }
    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const frame = normalizeZoneFrame(options?.timeZone);

    if (frame === null || epochUnit === null) return "";

    const largestUnit =
      typeof unit === "string" ? resolveDurationUnit(unit) : unit;

    if (!isValidDateTimeDurationUnit(largestUnit)) {
      return "";
    }

    const instant1 = unixEpochToInstant(value1, epochUnit);
    const instant2 = unixEpochToInstant(value2, epochUnit);

    if (instant1 === null || instant2 === null) {
      return "";
    }

    try {
      return durationUntilString(
        frameZoned(instant1, frame),
        frameZoned(instant2, frame),
        largestUnit,
        options,
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
