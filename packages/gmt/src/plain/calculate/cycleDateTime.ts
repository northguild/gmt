import { Temporal } from "@js-temporal/polyfill";
import {
  cycleFieldValue,
  dateCycleFieldBounds,
  timeCycleFieldBounds,
} from "../../internal";
import type { DateTimeCycleField, Overflow } from "../../types";
import {
  isValidDateCycleField,
  isValidDateTime,
  isValidDateTimeCycleField,
} from "../validate";
import { setDateTime } from "./setDateTime";

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
 * - `options.round` steps to the *next* multiple of `amount` in the direction of its sign
 *   (ceiling for positive, floor for negative) — not the nearest one. See `cycleDate`/`cycleTime`'s
 *   docs for worked examples.
 * - Returns "" for an invalid `value` or an invalid `field`.
 *
 * @param value ISO PlainDateTime string
 * @param field the field to cycle: "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
 * @param amount signed amount to cycle by
 * @param options optional: round (boolean, default false), overflow ("constrain" | "reject")
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
  options?: { round?: boolean; overflow?: Overflow },
): string {
  if (!isValidDateTime(value) || !isValidDateTimeCycleField(field)) return "";

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
