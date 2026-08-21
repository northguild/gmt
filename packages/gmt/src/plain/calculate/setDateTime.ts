import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidDateTime } from "../validate";

/**
 * Return a PlainDateTime ISO string with the given `fields` set on `value`.
 *
 * - Wraps `Temporal.PlainDateTime.prototype.with()`, which resolves every supplied field in a
 *   single atomic overflow pass — see `setDate`'s doc for why that matters over composing
 *   `addDateTime()` calls field-by-field.
 * - `fields` may set any of `year`, `month`, `monthCode`, `day`, `hour`, `minute`, `second`,
 *   `millisecond`, `microsecond`, `nanosecond`, `era`, and/or `eraYear`; omitted fields keep
 *   their current value. An empty object is a no-op.
 * - Returns "" for invalid input.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. setting
 * `month: 2` on a datetime whose `day` is 31: "constrain" clamps to Feb 29/28, "reject" throws
 * (resulting in "").
 *
 * @param value ISO PlainDateTime string
 * @param fields Partial<Temporal.PlainDateTimeLike> object specifying fields to set
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDateTime string with fields set, or "" on invalid input
 *
 * @example setDateTime("2024-03-10T12:00:00", { hour: 9 }) // "2024-03-10T09:00:00"
 * @example setDateTime("2024-01-31T12:00:00", { month: 2 }) // "2024-02-29T12:00:00" (constrain clamps to the last valid day)
 * @example setDateTime("2024-01-31T12:00:00", { month: 2 }, { overflow: "reject" }) // ""
 * @example setDateTime("2024-03-10T12:00:00", {}) // "2024-03-10T12:00:00" (empty fields object is a no-op)
 * @example setDateTime("invalid", { hour: 9 }) // ""
 */
export function setDateTime(
  value: string,
  fields: Omit<Temporal.PlainDateTimeLike, "calendar">,
  options?: { overflow?: Overflow },
): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    // Temporal.PlainDateTime.prototype.with() throws on an empty fields object ("no supported
    // properties found") rather than treating it as a no-op, so short-circuit here.
    if (Object.keys(fields).length === 0) return dateTime.toString();

    return dateTime
      .with(fields, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
