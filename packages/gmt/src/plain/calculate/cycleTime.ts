import { Temporal } from "@js-temporal/polyfill";
import { cycleFieldValue, timeCycleFieldBounds } from "../../internal";
import type { Overflow, TimeCycleField } from "../../types";
import { isValidTime, isValidTimeCycleField } from "../validate";
import { setTime } from "./setTime";

/**
 * Return a PlainTime ISO string with `field` cycled by `amount`, wrapping at that field's own
 * min/max instead of carrying into the next larger field (`hour` 23 `+1` wraps to `0`, it never
 * changes a date — `cycleTime` has no date component to carry into in the first place).
 *
 * - `hour` always cycles `0–23`. GMT has no `hourCycle: 12` option — a 12-hour, AM/PM-preserving
 *   wrap is a display/formatting concern (locale-driven, via `Intl`), not a value-layer one: there
 *   is no ISO representation for "this hour, but staying AM" to round-trip through GMT's string
 *   contract.
 * - `minute`/`second` wrap `0–59`; `millisecond`/`microsecond`/`nanosecond` wrap `0–999`.
 * - `options.round` does **not** round to the nearest increment — it steps to the *next* multiple
 *   of `amount` in the direction of its sign (ceiling for positive, floor for negative), matching
 *   `@internationalized/date`'s `CycleOptions.round`. E.g. cycling minute `22` by `+15` with
 *   `round: true` lands on `30` (the next multiple of 15 above 22), not `15` (the nearest one).
 * - `options.overflow` is accepted for signature consistency with `cycleDate`/`cycleDateTime`/
 *   `cycleZoned` but is **inert** here: time fields don't share bounds the way `day` shares a
 *   month with `month`/`year`, so the wrapped value `cycleTime` computes is always already valid —
 *   `setTime`'s `.with()` call never has anything to constrain or reject.
 * - Returns "" for an invalid `value` or an invalid `field`.
 *
 * @param value ISO PlainTime string
 * @param field the field to cycle: "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
 * @param amount signed amount to cycle by
 * @param options optional: round (boolean, default false), overflow ("constrain" | "reject", inert — see above)
 * @returns ISO PlainTime string with `field` cycled, or "" on invalid input
 *
 * @example cycleTime("09:30:00", "hour", 1) // "10:30:00"
 * @example cycleTime("23:00:00", "hour", 1) // "00:00:00" (wraps)
 * @example cycleTime("00:00:00", "hour", 25) // "01:00:00" (amount larger than the range)
 * @example cycleTime("09:22:00", "minute", 15, { round: true }) // "09:30:00"
 * @example cycleTime("09:30:00", "year", 1) // "" ("year" is not a cyclable time field)
 * @example cycleTime("invalid", "hour", 1) // ""
 */
export function cycleTime(
  value: string,
  field: TimeCycleField,
  amount: number,
  options?: { round?: boolean; overflow?: Overflow },
): string {
  if (!isValidTime(value) || !isValidTimeCycleField(field)) return "";

  try {
    const time = Temporal.PlainTime.from(value);
    const bounds = timeCycleFieldBounds(field);
    const newValue = cycleFieldValue(
      time[field],
      amount,
      bounds,
      options?.round ?? false,
    );
    return setTime(
      value,
      { [field]: newValue },
      { overflow: options?.overflow },
    );
  } catch {
    return "";
  }
}
