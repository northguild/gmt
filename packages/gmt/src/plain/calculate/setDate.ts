import { Temporal } from "@js-temporal/polyfill";
import { DATE_FIELDS, readSetFields, resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDate ISO string with the given `fields` set on `value`.
 *
 * - Wraps `Temporal.PlainDate.prototype.with()`, which resolves every supplied field in a
 *   single atomic overflow pass. This is the safe alternative to composing `addDate()` calls
 *   field-by-field: each sequential `.add()` resolves overflow against its own intermediate
 *   value, so setting month-then-day vs. day-then-month on the same target can silently
 *   diverge — `.with()` has no such order-dependence.
 * - `fields` may set `year`, `month`, `monthCode` and/or `day`; omitted fields keep their current
 *   value. An object with no field set, such as `{}` or `{ year: undefined }`, is a no-op.
 * - Values are not converted: `year`, `month` and `day` must be integer numbers and `monthCode` a
 *   string. `null`, a numeric string, a boolean or a fraction returns "", where Temporal would
 *   convert or truncate it. A bigint, `NaN` or an infinity returns "" too. A number too large for
 *   its field follows `overflow`. A month or day below 1, or a date outside Temporal's range,
 *   returns "".
 * - An own key that is not one of these fields, such as a misspelt `yaer`, returns "". So does a
 *   field this function does not take, such as `hour`, or a `calendar` or `timeZone` property,
 *   whether own, inherited or a getter. A field is read with a property get, as Temporal reads it,
 *   so an inherited or getter field is set.
 * - A Temporal date or time object returns "", as Temporal's `with` refuses one. One whose
 *   prototype has been replaced with `Object.prototype`, `null` or `Function.prototype` sets
 *   nothing instead.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDate string
 * @param fields Partial<Temporal.PlainDateLike> object specifying fields to set
 * @param options How an out-of-range field value is handled
 * @returns ISO PlainDate string with fields set, or "" on invalid input
 *
 * @example setDate("2024-03-10", { year: 2025 }) // "2025-03-10"
 * @example setDate("2024-01-31", { month: 2 }) // "2024-02-29" (constrain clamps to the last valid day)
 * @example setDate("2024-01-31", { month: 2 }, { overflow: "reject" }) // ""
 * @example setDate("2024-01-31", { month: 13 }) // "2024-12-31" (too large: constrain clamps it)
 * @example setDate("2024-01-31", { month: 0 }) // "" (below 1, under either overflow)
 * @example setDate("2024-03-10", {}) // "2024-03-10" (empty fields object is a no-op)
 * @example setDate("2024-01-31", { year: "2025" }) // "" (not converted)
 * @example setDate("2024-01-31", { year: 2025, yaer: 1 }) // "" (misspelt key)
 * @example setDate("2024-03-10", { year: 2025, hour: 5 }) // "" (setDate takes no hour)
 * @example setDate("invalid", { year: 2025 }) // ""
 */
export function setDate(
  value: string,
  fields: Omit<Temporal.PlainDateLike, "calendar" | "era" | "eraYear">,
  options?: {
    /**
     * What to do when the fields do not form a real date. `"constrain"` clamps to the last valid
     * day, so `month: 2` on the 31st gives Feb 29 or 28; `"reject"` returns `""`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (!isValidDate(value)) return "";

  try {
    const date = Temporal.PlainDate.from(value);
    const set = readSetFields(fields, DATE_FIELDS);
    if (set === null) return "";
    // Only the values readSetFields checked reach Temporal. An empty result sets nothing: a
    // no-op here, where Temporal's with() would throw.
    if (Object.keys(set).length === 0) return date.toString();

    return date
      .with(set, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
