// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../../duration/validate";
import { addToZoned, resolveOverflow, subtractFromZoned } from "../../internal";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  toUnixEpoch,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { Overflow } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Construct a Unix epoch interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - Converts to `ZonedDateTime` in `timeZone`, adds/subtracts
 *   the duration there, then converts back to epoch — this is what lets calendar units (years/months/
 *   weeks/days) resolve without a `relativeTo`: unlike a bare `Temporal.Instant`, the `ZonedDateTime`
 *   supplies its own implicit reference point.
 * - The computed boundary is floored to a whole `epochUnit`, so a duration shorter than one unit does
 *   not survive: with `anchor: "start"` the interval is empty (`"PT0.5S"` in seconds gives the
 *   same `{ start, end }` as `"PT0S"`), and with `anchor: "end"` the start falls back to the
 *   previous whole unit, making the interval one unit long.
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionUnix`'s `start > end` rejection.
 * - Returns null on invalid input (a `value` that is not a safe integer or numeric string of one —
 *   fractions, empty strings and values beyond ±(2^53 − 1) are invalid — invalid `duration`, an
 *   `anchor` other than `"start"`/`"end"`, or an invalid/unavailable timeZone).
 *
 * @param value Unix epoch value (seconds or milliseconds): a safe integer or a digit string
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional: how `value` is read and how an out-of-range result day is handled
 * @returns `{ start, end }` with the constructed span (epoch numbers), or null on invalid input
 *
 * @example intervalFromDurationUnix(1704067200000, "P1D", "start", { timeZone: "UTC" }) // { start: 1704067200000, end: 1704153600000 }
 * @example intervalFromDurationUnix(1704153600000, "P1D", "end", { timeZone: "UTC" }) // { start: 1704067200000, end: 1704153600000 }
 * @example intervalFromDurationUnix(1706659200000, "P1M", "start", { timeZone: "UTC", overflow: "reject" }) // null (Jan 31 + 1 month overflows)
 * @example intervalFromDurationUnix(1704067200000, "-P10D", "start", { timeZone: "UTC" }) // null (inverted span)
 * @example intervalFromDurationUnix("1704067200", "P1D", "start", { epochUnit: "second" }) // { start: 1704067200, end: 1704153600 } (UTC by default)
 * @example intervalFromDurationUnix(NaN, "P1D", "start") // null
 */
export function intervalFromDurationUnix(
  value: number | string,
  duration: string,
  anchor: "start" | "end",
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns null. The result is in the same unit.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the calendar arithmetic runs in: an IANA name, a UTC offset, or `"local"` for
     * the system time zone. An unknown zone returns null.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
    /**
     * How a result day that does not exist in its month is handled, such as January 31 plus one
     * month. `"constrain"` clamps to the last valid day, and `"reject"` returns null.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): {
  /**
   * The instant the interval begins at, as a Unix epoch number counted in `epochUnit`. A boundary
   * that falls between two whole units is rounded down to the earlier one.
   */
  start: number;
  /**
   * The first instant after the interval, counted in `epochUnit` and rounded as `start` is. It is
   * exclusive: the interval holds everything from `start` up to but not including this value. It
   * can equal `start`, which makes the interval empty.
   */
  end: number;
} | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    if (!isValidDuration(duration)) {
      return null;
    }

    if (anchor !== "start" && anchor !== "end") {
      return null;
    }

    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const timeZone = normalizeTimeZone(options?.timeZone);

    if (!timeZone || epochUnit === null) {
      return null;
    }

    const instant = unixEpochToInstant(value, epochUnit);

    if (instant === null) {
      return null;
    }

    try {
      const point = instant.toZonedDateTimeISO(timeZone);
      const dur = Temporal.Duration.from(duration);
      const overflow = resolveOverflow(options?.overflow);

      const other =
        anchor === "start"
          ? addToZoned(point, dur, { overflow })
          : subtractFromZoned(point, dur, { overflow });

      const start = anchor === "start" ? point : other;
      const end = anchor === "start" ? other : point;

      if (Temporal.ZonedDateTime.compare(start, end) > 0) {
        return null;
      }

      return {
        start: toUnixEpoch(start, epochUnit),
        end: toUnixEpoch(end, epochUnit),
      };
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
