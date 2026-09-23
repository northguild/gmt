// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { durationTotal, zonedUntil } from "../../internal";
import { resolveUnixIntervalPair } from "../../internal/resolveUnixIntervalPair";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the exact length of a Unix epoch interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountUnix`, which counts local calendar `unit` boundaries *crossed*
 *   rather than measuring exact duration.
 * - Reads `start` and `end` in `options.epochUnit` (`"milliseconds"` by default, `"seconds"`; singular
 *   accepted). Each is a safe integer or a string of optionally negative ASCII digits.
 * - Resolves calendar units in `options.timeZone`: omitted is `"UTC"`, `"local"` is the system
 *   zone, and an unknown zone returns `null`. Fixed-length units (hour, minute, second, …) are
 *   zone-independent; a day is a local day, so New York's 23-hour 2024-03-10 is 1 day long there.
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (`start`/`end` that is not a safe integer or numeric string of
 *   one, or lies outside the Temporal instant range, `start > end`, an unsupported unit, an invalid
 *   `epochUnit` or an unknown `timeZone`).
 *
 * @param start Unix epoch in `epochUnit` — interval start
 * @param end Unix epoch in `epochUnit` — interval end
 * @param unit unit string — any `DateTimeUnit`, singular or plural
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns exact length of the interval expressed in `unit`, or null on invalid input
 *
 * @example intervalLengthUnix(0, 86400000, "hour") // 24
 * @example intervalLengthUnix(0, 5400000, "hour") // 1.5
 * @example intervalLengthUnix(0, 0, "hour") // 0
 * @example intervalLengthUnix(86400000, 0, "hour") // null
 * @example intervalLengthUnix(1710046800000, 1710129600000, "day", { timeZone: "America/New_York" }) // 1 (the 23-hour local day)
 * @example intervalLengthUnix(1710046800000, 1710129600000, "day") // 0.9583333333333334 (23/24 of a UTC day)
 * @example intervalLengthUnix("0", "86400", "hours", { epochUnit: "second" }) // 24
 * @example intervalLengthUnix(NaN, 86400000, "hour") // null
 */
export function intervalLengthUnix(
  start: number | string,
  end: number | string,
  unit: string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    const resolved = resolveUnixIntervalPair(start, end, unit, options);

    if (!resolved) return null;

    try {
      const { startVal, endVal, resolvedUnit } = resolved;
      const duration = zonedUntil(startVal, endVal, {
        largestUnit: resolvedUnit,
      });

      // total() gives the exact elapsed length, unlike intervalCountUnix's boundary-crossing
      // count over the same zone's calendar.
      return durationTotal(duration, resolvedUnit, startVal);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
