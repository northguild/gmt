import { Temporal } from "@js-temporal/polyfill";
import {
  cycleFieldValue,
  dateCycleFieldBounds,
  isValidAmount,
  timeCycleFieldBounds,
} from "../../internal";
import type { DateTimeCycleField, Overflow } from "../../types";
import {
  isValidDateCycleField,
  isValidDateTime,
  isValidDateTimeCycleField,
} from "../validate";
import { setDateTime } from "./setDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDateTime ISO string with `field` cycled by `amount`, wrapping at that field's own
 * min/max instead of carrying into the next larger field.
 *
 * - `cycleDateTime` is not `addDateTime`: cycling December's `month` by `+1` stays in the same
 *   year, and cycling `hour` `23` by `+1` stays on the same day. Reach for `addDateTime` for
 *   calendar/clock arithmetic; reach for `cycleDateTime` when a single field (e.g. a datepicker
 *   segment) must stay isolated from the others.
 * - Date fields (`year`/`month`/`day`) wrap the same way `cycleDate` does — `year` is unbounded,
 *   `month` wraps `1–12`, `day` wraps `1`–the current month's day count. Time fields
 *   (`hour`/`minute`/`second`/`millisecond`/`microsecond`/`nanosecond`) wrap the same way
 *   `cycleTime` does — `hour` always `0–23` (no `hourCycle: 12` option; see `cycleTime`'s doc for
 *   why).
 * - Cycling `month` or `year` can still shift `day` via `overflow`, exactly as `setDateTime`'s
 *   `.with()` call does.
 * - Returns "" for an invalid `value`, an invalid `field`, or an `amount` that is not a finite number.
 *
 * @param value ISO PlainDateTime string
 * @param field the field to cycle: "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
 * @param amount signed amount to cycle by
 * @param options How the field is stepped and an out-of-range day is handled
 * @returns ISO PlainDateTime string with `field` cycled, or "" on invalid input
 *
 * @example cycleDateTime("2024-06-15T09:30:00", "hour", 1) // "2024-06-15T10:30:00"
 * @example cycleDateTime("2024-12-15T23:30:00", "month", 1) // "2024-01-15T23:30:00" (wraps, stays in the same year)
 * @example cycleDateTime("2024-12-15T23:30:00", "hour", 1) // "2024-12-15T00:30:00" (wraps, stays on the same day)
 * @example cycleDateTime("2024-06-15T09:22:00", "minute", 15, { round: true }) // "2024-06-15T09:30:00"
 * @example cycleDateTime("2024-06-15T09:30:00", "week", 1) // "" ("week" is not a cyclable field)
 * @example cycleDateTime("invalid", "hour", 1) // ""
 */
export function cycleDateTime(
  value: string,
  field: DateTimeCycleField,
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
    !isValidDateTime(value) ||
    !isValidDateTimeCycleField(field) ||
    !isValidAmount(amount)
  ) {
    return "";
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    const bounds = isValidDateCycleField(field)
      ? dateCycleFieldBounds(field, dateTime)
      : timeCycleFieldBounds(field);
    const newValue = cycleFieldValue(
      dateTime[field],
      amount,
      bounds,
      options?.round ?? false,
    );
    return setDateTime(
      value,
      { [field]: newValue },
      { overflow: options?.overflow },
    );
  } catch {
    return "";
  }
}
