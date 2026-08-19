import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../../duration/validate";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Construct a UTC interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - Converts to `ZonedDateTime("UTC")`, adds/subtracts the duration there, then converts back to an
 *   Instant — this is what lets calendar units (years/months/weeks/days) resolve without a
 *   `relativeTo`: unlike a bare `Temporal.Instant`, the `ZonedDateTime` supplies its own implicit
 *   reference point (mirrors `addUtc`).
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionUtc`'s `start > end` rejection.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 *   to Jan 31: "constrain" clamps to Feb 29/28, "reject" returns null.
 * - Returns null on invalid input (unparseable `value`, invalid `duration`, or an `anchor` other
 *   than `"start"`/`"end"`).
 *
 * @param value ISO UTC datetime string (e.g. "2024-03-10T12:00:00Z")
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional: overflow ("constrain" | "reject")
 * @returns `{ start, end }` with the constructed span (UTC Instant strings), or null on invalid input
 *
 * @example intervalFromDurationUtc("2024-01-01T00:00:00Z", "P1D", "start") // { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }
 * @example intervalFromDurationUtc("2024-01-02T00:00:00Z", "P1D", "end") // { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }
 * @example intervalFromDurationUtc("2024-01-31T00:00:00Z", "P1M", "start", { overflow: "reject" }) // null
 * @example intervalFromDurationUtc("2024-01-05T00:00:00Z", "-P10D", "start") // null (inverted span)
 * @example intervalFromDurationUtc("invalid", "P1D", "start") // null
 */
export function intervalFromDurationUtc(
  value: string,
  duration: string,
  anchor: "start" | "end",
  options?: { overflow?: Overflow },
): { start: string; end: string } | null {
  if (typeof value !== "string" || !isValidUtc(value)) {
    return null;
  }

  if (!isValidDuration(duration)) {
    return null;
  }

  if (anchor !== "start" && anchor !== "end") {
    return null;
  }

  try {
    const instant = Temporal.Instant.from(value);
    const point = instant.toZonedDateTimeISO("UTC");
    const dur = Temporal.Duration.from(duration);
    const overflow = resolveOverflow(options?.overflow);

    const other =
      anchor === "start"
        ? point.add(dur, { overflow })
        : point.subtract(dur, { overflow });

    const start = anchor === "start" ? point : other;
    const end = anchor === "start" ? other : point;

    if (Temporal.ZonedDateTime.compare(start, end) > 0) {
      return null;
    }

    return {
      start: start.toInstant().toString(),
      end: end.toInstant().toString(),
    };
  } catch {
    return null;
  }
}
