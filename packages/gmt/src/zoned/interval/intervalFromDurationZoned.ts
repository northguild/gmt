import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../../duration/validate";
import { resolveOverflow } from "../../internal";
import type { Disambiguation, Offset, Overflow } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Construct a zoned interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - Uses `Temporal.ZonedDateTime.prototype.add`/`.subtract`, so calendar units (years/months/weeks)
 *   resolve against `value` itself — no separate `relativeTo` is needed.
 * - `disambiguation` controls DST resolution ONLY when the arithmetic result lands on an ambiguous
 *   local time from a fall-back (DST-end) overlap: "compatible" (default), "earlier", "later", or
 *   "reject" (returns null). Mirrors `addZoned`'s exact semantics — has no effect on a spring-forward
 *   (DST-start) gap landing, which Temporal's arithmetic always resolves before disambiguation runs.
 * - `offset` is accepted for API consistency with `addZoned` but has **no effect here** for the same
 *   reason documented there: the disambiguation rebuild has no stored offset to prefer/use/ignore/reject.
 * - A negative `duration` (e.g. `"-P1D"`) can invert the computed span; returns null when that
 *   happens, mirroring `intervalIntersectionZoned`'s `start > end` rejection.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 *   to Jan 31: "constrain" clamps to Feb 29/28, "reject" returns null.
 * - Returns null on invalid input (unparseable `value`, invalid `duration`, or an `anchor` other
 *   than `"start"`/`"end"`).
 *
 * @param value ISO 8601 zoned datetime string
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional: disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject" — accepted but inert, see above), overflow ("constrain" | "reject")
 * @returns `{ start, end }` with the constructed span, or null on invalid input
 *
 * @example intervalFromDurationZoned("2024-01-01T00:00:00+00:00[UTC]", "P1D", "start") // { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }
 * @example intervalFromDurationZoned("2024-01-02T00:00:00+00:00[UTC]", "P1D", "end") // { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }
 * @example intervalFromDurationZoned("2024-11-02T01:30:00-04:00[America/New_York]", "P1D", "start", { disambiguation: "later" }) // { start: "2024-11-02T01:30:00-04:00[America/New_York]", end: "2024-11-03T01:30:00-05:00[America/New_York]" } (fall-back overlap resolved; default "compatible" would return the -04:00 instant instead)
 * @example intervalFromDurationZoned("2024-01-31T12:00:00-05:00[America/New_York]", "P1M", "start", { overflow: "reject" }) // null
 * @example intervalFromDurationZoned("invalid", "P1D", "start") // null
 */
export function intervalFromDurationZoned(
  value: string,
  duration: string,
  anchor: "start" | "end",
  options?: {
    disambiguation?: Disambiguation;
    offset?: Offset;
    overflow?: Overflow;
  },
): { start: string; end: string } | null {
  if (typeof value !== "string" || !isValidZonedDateTime(value)) {
    return null;
  }

  if (!isValidDuration(duration)) {
    return null;
  }

  if (anchor !== "start" && anchor !== "end") {
    return null;
  }

  const disambiguation = options?.disambiguation ?? "compatible";
  const offset = options?.offset ?? "ignore";
  const overflow = resolveOverflow(options?.overflow);

  try {
    const point = Temporal.ZonedDateTime.from(value);
    const dur = Temporal.Duration.from(duration);

    const rawOther =
      anchor === "start"
        ? point.add(dur, { overflow })
        : point.subtract(dur, { overflow });

    const other =
      disambiguation === "compatible"
        ? rawOther
        : Temporal.ZonedDateTime.from(
            `${rawOther.toPlainDateTime().toString()}[${rawOther.timeZoneId}]`,
            { disambiguation, offset },
          );

    const start = anchor === "start" ? point : other;
    const end = anchor === "start" ? other : point;

    if (Temporal.ZonedDateTime.compare(start, end) > 0) {
      return null;
    }

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
