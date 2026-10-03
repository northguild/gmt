import { Temporal } from "@js-temporal/polyfill";
import {
  cycleFieldValue,
  dateCycleFieldBounds,
  isValidAmount,
} from "../../internal";
import type { DateCycleField, Overflow } from "../../types";
import { isValidDate, isValidDateCycleField } from "../validate";
import { setDate } from "./setDate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDate ISO string with `field` cycled by `amount`, wrapping at that field's own
 * min/max instead of carrying into the next larger field.
 *
 * - `cycleDate` is not `addDate`: cycling December's `month` by `+1` stays in the same year
 *   (`"2024-12-15"` → `"2024-01-15"`), where `addDate(value, { months: 1 })` would correctly
 *   overflow into January of the *next* year. Reach for `addDate` when you want calendar
 *   arithmetic; reach for `cycleDate` when a single field (e.g. a datepicker segment) must stay
 *   isolated from the others.
 * - `year` has no upper/lower wrap — cycling it is plain addition (or a step to a multiple, with
 *   `round`): `2022` by `+5` with `round: true` lands on `2025`, the next multiple of 5.
 *   `month` wraps `1–12`. `day` wraps `1`–the **current** month's day count, so cycling `day`
 *   never changes `month`.
 * - Cycling `month` or `year` can still shift `day` via `overflow` — e.g. cycling `month` from a
 *   31st into a shorter month clamps under the default `"constrain"` (or returns `""` under
 *   `"reject"`) exactly the way `setDate`'s own `.with()` call does; this is the same clamping
 *   `addDate`'s Jan 31 + 1 month case produces, not new behavior.
 * - Returns "" for an invalid `value`, an invalid `field`, or an `amount` that is not a finite number.
 *
 * @param value ISO PlainDate string
 * @param field the field to cycle: "year" | "month" | "day"
 * @param amount signed amount to cycle by
 * @param options How the field is stepped and an out-of-range day is handled
 * @returns ISO PlainDate string with `field` cycled, or "" on invalid input
 *
 * @example cycleDate("2024-06-15", "month", 1) // "2024-07-15"
 * @example cycleDate("2024-12-15", "month", 1) // "2024-01-15" (wraps, stays in the same year)
 * @example cycleDate("2024-12-31", "day", 1) // "2024-12-01" (wraps within the same month)
 * @example cycleDate("2024-01-15", "month", 13) // "2024-02-15" (amount larger than the range)
 * @example cycleDate("2024-01-31", "month", 1) // "2024-02-29" (constrain clamps the day)
 * @example cycleDate("2024-01-31", "month", 1, { overflow: "reject" }) // ""
 * @example cycleDate("2022-02-03", "year", 5, { round: true }) // "2025-02-03"
 * @example cycleDate("2024-06-15", "week", 1) // "" ("week" is not a cyclable date field)
 * @example cycleDate("invalid", "month", 1) // ""
 */
export function cycleDate(
  value: string,
  field: DateCycleField,
  amount: number,
  options?: {
    /**
     * Whether to step to a multiple of `amount` instead of adding it. `true` moves to the next
     * multiple in the direction of the sign of `amount` (the ceiling for a positive amount, the
     * floor for a negative one), not to the nearest one; `false` adds `amount`.
     *
     * @defaultValue `false`
     */
    round?: boolean;
    /**
     * What to do when the cycled `month` or `year` leaves `day` past the end of its month.
     * `"constrain"` clamps `day` to the last day of that month; `"reject"` returns `""`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (
    !isValidDate(value) ||
    !isValidDateCycleField(field) ||
    !isValidAmount(amount)
  ) {
    return "";
  }

  try {
    const date = Temporal.PlainDate.from(value);
    const bounds = dateCycleFieldBounds(field, date);
    const newValue = cycleFieldValue(
      date[field],
      amount,
      bounds,
      options?.round ?? false,
    );
    return setDate(
      value,
      { [field]: newValue },
      { overflow: options?.overflow },
    );
  } catch {
    return "";
  }
}
