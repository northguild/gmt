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
 * - Converts to `ZonedDateTime` in `timeZone` (`"UTC"` by default, consistent with `addUnix`; `"local"`
 *   is the system zone), adds/subtracts
 *   the duration there, then converts back to epoch — this is what lets calendar units (years/months/
 *   weeks/days) resolve without a `relativeTo`: unlike a bare `Temporal.Instant`, the `ZonedDateTime`
 *   supplies its own implicit reference point.
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionUnix`'s `start > end` rejection.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 *   to Jan 31: "constrain" clamps to Feb 29/28, "reject" returns null.
 * - Returns null on invalid input (a `value` that is not a safe integer or numeric string of one —
 *   fractions, empty strings and values beyond ±(2^53 − 1) are invalid — invalid `duration`, an
 *   `anchor` other than `"start"`/`"end"`, or an invalid/unavailable timeZone).
 *
 * @param value Unix epoch value (seconds or milliseconds): a safe integer or a digit string
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"), overflow ("constrain" | "reject")
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
    epochUnit?: UnixUnit;
    timeZone?: string;
    overflow?: Overflow;
  },
): { start: number; end: number } | null {
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
