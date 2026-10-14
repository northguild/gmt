import { Temporal } from "@js-temporal/polyfill";
import {
  DATE_TIME_FIELDS,
  readSetFields,
  resolveOverflow,
} from "../../internal";
import type { Overflow } from "../../types";
import { isValidDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDateTime ISO string with the given `fields` set on `value`.
 *
 * - Wraps `Temporal.PlainDateTime.prototype.with()`, which resolves every supplied field in a
 *   single atomic overflow pass — see `setDate`'s doc for why that matters over composing
 *   `addDateTime()` calls field-by-field.
 * - `fields` may set any of `year`, `month`, `monthCode`, `day`, `hour`, `minute`, `second`,
 *   `millisecond`, `microsecond` and/or `nanosecond`; omitted fields keep their current value. An
 *   object with no field set, such as `{}` or `{ year: undefined }`, is a no-op.
 * - Values are not converted: `monthCode` must be a string and every other field an integer number.
 *   `null`, a numeric string, a boolean, a bigint, `NaN`, an infinity or a fraction returns "",
 *   where Temporal would convert it. A number too large for its field follows `overflow`. A month
 *   or day below 1, or a date outside Temporal's range, returns "".
 * - An own key that is not one of these fields, such as a misspelt `yaer`, returns "". So does an
 *   era, or a `calendar` or `timeZone` property, whether own, inherited or a getter. A field is
 *   read with a property get, as Temporal reads it, so an inherited or getter field is set.
 * - A Temporal date or time object returns "", as Temporal's `with` refuses one. One whose
 *   prototype has been replaced with `Object.prototype`, `null` or `Function.prototype` sets
 *   nothing instead.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDateTime string
 * @param fields Partial<Temporal.PlainDateTimeLike> object specifying fields to set
 * @param options How an out-of-range field value is handled
 * @returns ISO PlainDateTime string with fields set, or "" on invalid input
 *
 * @example setDateTime("2024-03-10T12:00:00", { hour: 9 }) // "2024-03-10T09:00:00"
 * @example setDateTime("2024-01-31T12:00:00", { month: 2 }) // "2024-02-29T12:00:00" (constrain clamps to the last valid day)
 * @example setDateTime("2024-01-31T12:00:00", { month: 2 }, { overflow: "reject" }) // ""
 * @example setDateTime("2024-03-10T12:00:00", {}) // "2024-03-10T12:00:00" (empty fields object is a no-op)
 * @example setDateTime("2024-03-10T12:00:00", { hour: "9" }) // "" (not converted)
 * @example setDateTime("invalid", { hour: 9 }) // ""
 */
export function setDateTime(
  value: string,
  fields: Omit<Temporal.PlainDateTimeLike, "calendar" | "era" | "eraYear">,
  options?: {
    /**
     * What to do when the fields do not form a real date-time. `"constrain"` clamps each field to
     * its nearest valid value, so `month: 2` on the 31st gives Feb 29 or 28; `"reject"` returns
     * `""`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    const set = readSetFields(fields, DATE_TIME_FIELDS);
    if (set === null) return "";
    // Only the values readSetFields checked reach Temporal. An empty result sets nothing: a
    // no-op here, where Temporal's with() would throw.
    if (Object.keys(set).length === 0) return dateTime.toString();

    return dateTime
      .with(set, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
