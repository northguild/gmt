import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../../duration/validate";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidTime } from "../validate";

/**
 * Construct a time interval from a single point plus an ISO 8601 duration, anchored at either end.
 *
 * - `anchor: "start"` treats `value` as the interval start and adds `duration` to get the end.
 * - `anchor: "end"` treats `value` as the interval end and subtracts `duration` to get the start.
 * - `PlainTime` has no calendar, so a `duration` with a nonzero years/months/weeks/days component
 *   cannot be resolved against a bare clock time — there is no `relativeTo` to supply (mirrors
 *   A2/A3's documented `relativeTo` gap). `Temporal.PlainTime.prototype.add` silently discards
 *   those fields rather than throwing, so this is checked explicitly and returns null.
 * - A `duration` that wraps past midnight (e.g. `"23:00:00"` + `"PT2H"`) produces a span PlainTime
 *   can't represent (no date component for the day rollover) and returns null, same as any other
 *   inverted span.
 * - `overflow` ("constrain" (default) | "reject") is accepted for API consistency with sibling
 *   `intervalFromDuration*` functions, but `PlainTime` arithmetic always wraps around the clock
 *   rather than producing an out-of-range value, so it has no observable effect here (mirrors
 *   `addTime`'s own documented no-op).
 * - Returns null on invalid input (unparseable `value`, invalid `duration`, or an `anchor` other
 *   than `"start"`/`"end"`).
 *
 * @param value ISO PlainTime string
 * @param duration ISO 8601 duration string
 * @param anchor "start" | "end" — which endpoint `value` represents
 * @param options optional: overflow ("constrain" | "reject" — accepted but inert, see above)
 * @returns `{ start, end }` with the constructed span, or null on invalid input
 *
 * @example intervalFromDurationTime("12:00:00", "PT1H", "start") // { start: "12:00:00", end: "13:00:00" }
 * @example intervalFromDurationTime("13:00:00", "PT1H", "end") // { start: "12:00:00", end: "13:00:00" }
 * @example intervalFromDurationTime("12:00:00", "P1D", "start") // null (date units need relativeTo, unsupported)
 * @example intervalFromDurationTime("23:00:00", "PT2H", "start") // null (wraps past midnight, inverted span)
 * @example intervalFromDurationTime("invalid", "PT1H", "start") // null
 */
export function intervalFromDurationTime(
  value: string,
  duration: string,
  anchor: "start" | "end",
  options?: { overflow?: Overflow },
): { start: string; end: string } | null {
  if (typeof value !== "string" || !isValidTime(value)) {
    return null;
  }

  if (!isValidDuration(duration)) {
    return null;
  }

  if (anchor !== "start" && anchor !== "end") {
    return null;
  }

  try {
    const dur = Temporal.Duration.from(duration);

    if (
      dur.years !== 0 ||
      dur.months !== 0 ||
      dur.weeks !== 0 ||
      dur.days !== 0
    ) {
      return null;
    }

    const point = Temporal.PlainTime.from(value);
    const overflow = resolveOverflow(options?.overflow);

    const other =
      anchor === "start"
        ? point.add(dur, { overflow })
        : point.subtract(dur, { overflow });

    const start = anchor === "start" ? point : other;
    const end = anchor === "start" ? other : point;

    if (Temporal.PlainTime.compare(start, end) > 0) {
      return null;
    }

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
