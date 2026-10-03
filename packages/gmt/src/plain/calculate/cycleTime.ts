import { Temporal } from "@js-temporal/polyfill";
import {
  cycleFieldValue,
  isValidAmount,
  timeCycleFieldBounds,
} from "../../internal";
import type { TimeCycleField } from "../../types";
import { isValidTime, isValidTimeCycleField } from "../validate";
import { setTime } from "./setTime";
import { isOptionsArgument } from "../../internal/isObject";

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
 * - With `round: true`, minute `22` by `+15` lands on `30`, the next multiple of 15 above 22, not
 *   on `15`, the nearest one.
 * - There is no `overflow` option (removed in 1.16.0): time fields don't share bounds the way `day`
 *   shares a month with `month`/`year`, so the wrapped value is always already valid and there is
 *   nothing to constrain or reject.
 * - Returns "" for an invalid `value`, an invalid `field`, or an `amount` that is not a finite number.
 *
 * @param value ISO PlainTime string
 * @param field the field to cycle: "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
 * @param amount signed amount to cycle by
 * @param options How the field is stepped
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
  options?: {
    /**
     * Whether to step to a multiple of `amount` instead of adding it. `true` moves to the next
     * multiple in the direction of the sign of `amount` (the ceiling for a positive amount, the
     * floor for a negative one), not to the nearest one; `false` adds `amount`.
     *
     * @defaultValue `false`
     */
    round?: boolean;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (
    !isValidTime(value) ||
    !isValidTimeCycleField(field) ||
    !isValidAmount(amount)
  ) {
    return "";
  }

  try {
    const time = Temporal.PlainTime.from(value);
    const bounds = timeCycleFieldBounds(field);
    const newValue = cycleFieldValue(
      time[field],
      amount,
      bounds,
      options?.round ?? false,
    );
    return setTime(value, { [field]: newValue });
  } catch {
    return "";
  }
}
