import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidDate } from "../validate";

/**
 * Return a PlainDate ISO string with the given `fields` set on `value`.
 *
 * - Wraps `Temporal.PlainDate.prototype.with()`, which resolves every supplied field in a
 *   single atomic overflow pass. This is the safe alternative to composing `addDate()` calls
 *   field-by-field: each sequential `.add()` resolves overflow against its own intermediate
 *   value, so setting month-then-day vs. day-then-month on the same target can silently
 *   diverge — `.with()` has no such order-dependence.
 * - `fields` may set `year`, `month`, `monthCode`, `day`, `era`, and/or `eraYear`; omitted
 *   fields keep their current value. An empty object is a no-op.
 * - Returns "" for invalid input.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. setting
 * `month: 2` on a date whose `day` is 31: "constrain" clamps to Feb 29/28, "reject" throws
 * (resulting in "").
 *
 * @param value ISO PlainDate string
 * @param fields Partial<Temporal.PlainDateLike> object specifying fields to set
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDate string with fields set, or "" on invalid input
 *
 * @example setDate("2024-03-10", { year: 2025 }) // "2025-03-10"
 * @example setDate("2024-01-31", { month: 2 }) // "2024-02-29" (constrain clamps to the last valid day)
 * @example setDate("2024-01-31", { month: 2 }, { overflow: "reject" }) // ""
 * @example setDate("2024-03-10", {}) // "2024-03-10" (empty fields object is a no-op)
 * @example setDate("invalid", { year: 2025 }) // ""
 */
export function setDate(
  value: string,
  fields: Omit<Temporal.PlainDateLike, "calendar">,
  options?: { overflow?: Overflow },
): string {
  if (!isValidDate(value)) return "";

  try {
    const date = Temporal.PlainDate.from(value);
    // Temporal.PlainDate.prototype.with() throws on an empty fields object ("no supported
    // properties found") rather than treating it as a no-op, so short-circuit here.
    if (Object.keys(fields).length === 0) return date.toString();

    return date
      .with(fields, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
