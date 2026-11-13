import { plainDateTimeOf, durationOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Construct a datetime interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - Uses `Temporal.PlainDateTime.prototype.add`/`.subtract`, so calendar units (years/months/weeks)
 *   resolve against `value` itself — no separate `relativeTo` is needed, unlike `addDuration`.
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionDateTime`'s `start > end` rejection.
 * - Returns null on invalid input (unparseable `value`, invalid `duration`, or an `anchor` other
 *   than `"start"`/`"end"`).
 *
 * @param value ISO PlainDateTime string
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options How an out-of-range endpoint is handled
 * @returns `{ start, end }` with the constructed span, or null on invalid input
 *
 * @example intervalFromDurationDateTime("2024-01-01T00:00:00", "P1DT2H", "start") // { start: "2024-01-01T00:00:00", end: "2024-01-02T02:00:00" }
 * @example intervalFromDurationDateTime("2024-01-02T02:00:00", "P1DT2H", "end") // { start: "2024-01-01T00:00:00", end: "2024-01-02T02:00:00" }
 * @example intervalFromDurationDateTime("2024-01-31T12:00:00", "P1M", "start", { overflow: "reject" }) // null
 * @example intervalFromDurationDateTime("2024-01-05T00:00:00", "-P10D", "start") // null (inverted span)
 * @example intervalFromDurationDateTime("invalid", "P1D", "start") // null
 */
export function intervalFromDurationDateTime(
  value: string,
  duration: string,
  anchor: "start" | "end",
  options?: {
    /**
     * What to do when the computed endpoint is not a real date. `"constrain"` clamps it to the
     * last valid day, so Jan 31 + 1 month is Feb 29 or 28; `"reject"` returns `null`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): {
  /**
   * The date-time the interval begins at, as an ISO 8601 date-time string with no offset or time
   * zone.
   */
  start: string;
  /**
   * The first date-time after the interval, in the same format as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It can equal
   * `start`, which makes the interval empty.
   */
  end: string;
} | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  const point = plainDateTimeOf(value);
  if (typeof value !== "string" || point === null) {
    return null;
  }

  const dur = durationOf(duration);

  if (dur === null) {
    return null;
  }

  if (anchor !== "start" && anchor !== "end") {
    return null;
  }

  try {
    const overflow = resolveOverflow(options?.overflow);

    const other =
      anchor === "start"
        ? point.add(dur, { overflow })
        : point.subtract(dur, { overflow });

    const start = anchor === "start" ? point : other;
    const end = anchor === "start" ? other : point;

    if (Temporal.PlainDateTime.compare(start, end) > 0) {
      return null;
    }

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
