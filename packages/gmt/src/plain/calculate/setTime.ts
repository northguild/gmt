import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainTime ISO string with the given `fields` set on `value`.
 *
 * - Wraps `Temporal.PlainTime.prototype.with()`, which resolves every supplied field in a
 *   single atomic overflow pass — see `setDate`'s doc for why that matters over composing
 *   `addTime()` calls field-by-field.
 * - `fields` may set any of `hour`, `minute`, `second`, `millisecond`, `microsecond`, and/or
 *   `nanosecond`; omitted fields keep their current value. An empty object is a no-op.
 * - Unlike `addTime`, which takes no `overflow` because addition always wraps around the clock,
 *   `overflow` has an effect here: `.with()` assigns fixed field values rather than adding a
 *   delta.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainTime string
 * @param fields Partial<Temporal.PlainTimeLike> object specifying fields to set
 * @param options How an out-of-range field value is handled
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
  options?: {
    /**
     * What to do when a field value is out of range. `"constrain"` clamps it to the nearest valid
     * value, so `hour: 25` becomes 23; `"reject"` returns `""`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

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
