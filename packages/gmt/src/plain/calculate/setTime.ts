import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidTime } from "../validate";

/**
 * Return a PlainTime ISO string with the given `fields` set on `value`.
 *
 * - Wraps `Temporal.PlainTime.prototype.with()`, which resolves every supplied field in a
 *   single atomic overflow pass — see `setDate`'s doc for why that matters over composing
 *   `addTime()` calls field-by-field.
 * - `fields` may set any of `hour`, `minute`, `second`, `millisecond`, `microsecond`, and/or
 *   `nanosecond`; omitted fields keep their current value. An empty object is a no-op.
 * - Returns "" for invalid input.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range field values, e.g.
 * `hour: 25`: "constrain" clamps to 23, "reject" throws (resulting in ""). Unlike `addTime`
 * (where `overflow` is inert because addition always wraps around the clock), `overflow` has
 * a real effect here because `.with()` assigns fixed field values rather than adding a delta.
 *
 * @param value ISO PlainTime string
 * @param fields Partial<Temporal.PlainTimeLike> object specifying fields to set
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainTime string with fields set, or "" on invalid input
 *
 * @example setTime("12:00:00", { hour: 9 }) // "09:00:00"
 * @example setTime("12:00:00", { hour: 25 }) // "23:00:00" (constrain clamps to the max valid hour)
 * @example setTime("12:00:00", { hour: 25 }, { overflow: "reject" }) // ""
 * @example setTime("12:00:00", {}) // "12:00:00" (empty fields object is a no-op)
 * @example setTime("invalid", { hour: 9 }) // ""
 */
export function setTime(
  value: string,
  fields: Temporal.PlainTimeLike,
  options?: { overflow?: Overflow },
): string {
  if (!isValidTime(value)) return "";

  try {
    const time = Temporal.PlainTime.from(value);
    // Temporal.PlainTime.prototype.with() throws on an empty fields object ("invalid time-like")
    // rather than treating it as a no-op, so short-circuit here.
    if (Object.keys(fields).length === 0) return time.toString();

    return time
      .with(fields, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
