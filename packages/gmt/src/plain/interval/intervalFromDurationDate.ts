import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../../duration/validate";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidDate } from "../validate";

/**
 * Construct a date interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - Uses `Temporal.PlainDate.prototype.add`/`.subtract`, so calendar units (years/months/weeks)
 *   resolve against `value` itself — no separate `relativeTo` is needed, unlike `addDuration`.
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionDate`'s `start > end` rejection.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 *   to Jan 31: "constrain" clamps to Feb 29/28, "reject" returns null.
 * - Returns null on invalid input (unparseable `value`, invalid `duration`, or an `anchor` other
 *   than `"start"`/`"end"`).
 *
 * @param value ISO PlainDate string
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional: overflow ("constrain" | "reject")
 * @returns `{ start, end }` with the constructed span, or null on invalid input
 *
 * @example intervalFromDurationDate("2024-01-01", "P1M", "start") // { start: "2024-01-01", end: "2024-02-01" }
 * @example intervalFromDurationDate("2024-02-01", "P1M", "end") // { start: "2024-01-01", end: "2024-02-01" }
 * @example intervalFromDurationDate("2024-01-31", "P1M", "start", { overflow: "reject" }) // null
 * @example intervalFromDurationDate("2024-01-05", "-P10D", "start") // null (inverted span)
 * @example intervalFromDurationDate("invalid", "P1M", "start") // null
 */
export function intervalFromDurationDate(
  value: string,
  duration: string,
  anchor: "start" | "end",
  options?: { overflow?: Overflow },
): { start: string; end: string } | null {
  if (typeof value !== "string" || !isValidDate(value)) {
    return null;
  }

  if (!isValidDuration(duration)) {
    return null;
  }

  if (anchor !== "start" && anchor !== "end") {
    return null;
  }

  try {
    const point = Temporal.PlainDate.from(value);
    const dur = Temporal.Duration.from(duration);
    const overflow = resolveOverflow(options?.overflow);

    const other =
      anchor === "start"
        ? point.add(dur, { overflow })
        : point.subtract(dur, { overflow });

    const start = anchor === "start" ? point : other;
    const end = anchor === "start" ? other : point;

    if (Temporal.PlainDate.compare(start, end) > 0) {
      return null;
    }

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
