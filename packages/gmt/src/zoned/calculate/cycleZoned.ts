import {
  cycleFieldValue,
  dateCycleFieldBounds,
  isValidAmount,
  timeCycleFieldBounds,
  zonedDateTimeFrom,
} from "../../internal";
import {
  isValidDateCycleField,
  isValidDateTimeCycleField,
} from "../../plain/validate";
import type {
  DateTimeCycleField,
  Disambiguation,
  Offset,
  Overflow,
} from "../../types";
import { isValidZonedDateTime } from "../validate";
import { setZoned } from "./setZoned";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a ZonedDateTime ISO string with `field` cycled by `amount`, wrapping at that field's own
 * min/max instead of carrying into the next larger field.
 *
 * - `cycleZoned` is not `addZoned`: cycling December's `month` by `+1` stays in the same year, and
 *   cycling `hour` `23` by `+1` stays on the same day. Reach for `addZoned` for calendar/clock
 *   arithmetic; reach for `cycleZoned` when a single field (e.g. a datepicker segment) must stay
 *   isolated from the others.
 * - Wrap bounds are computed the same way as `cycleDateTime` — plain local-field bounds (`hour`
 *   always `0–23`, etc.), **not** DST-aware absolute-time bounds. The wrapped local time is then
 *   handed to `setZoned`, whose `.with()` call — via `disambiguation` and `offset` — resolves
 *   whatever DST edge case results (the wrapped local time landing in a gap or an overlap) exactly
 *   the way it resolves any other field-set call. This is deliberately simpler than deriving
 *   DST-aware wrap boundaries directly.
 * - **Compatibility:** before 1.16.0 `offset` defaulted to `"ignore"`. Pass `{ offset: "ignore" }`
 *   to keep that resolution.
 * - Returns "" for an invalid `value`, an invalid `field`, or an `amount` that is not a finite number.
 *
 * @param value zoned ISO 8601 datetime string
 * @param field the field to cycle: "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
 * @param amount signed amount to cycle by
 * @param options optional settings for rounding the step and resolving the cycled wall-clock time
 * @returns zoned ISO 8601 string with `field` cycled, or "" on invalid input
 *
 * @example cycleZoned("2024-06-15T09:30:00-05:00[America/Chicago]", "hour", 1) // "2024-06-15T10:30:00-05:00[America/Chicago]"
 * @example cycleZoned("2024-12-15T09:30:00-06:00[America/Chicago]", "month", 1) // "2024-01-15T09:30:00-06:00[America/Chicago]" (wraps, stays in the same year)
 * @example cycleZoned("2024-03-10T01:30:00-06:00[America/Chicago]", "hour", 1) // "2024-03-10T03:30:00-05:00[America/Chicago]" (cycled hour lands in a spring-forward gap; "compatible" skips forward)
 * @example cycleZoned("2024-03-10T01:30:00-06:00[America/Chicago]", "hour", 1, { disambiguation: "reject" }) // "" (same gap; "reject" throws)
 * @example cycleZoned("2024-11-03T00:30:00-05:00[America/Chicago]", "hour", 1, { disambiguation: "reject" }) // "2024-11-03T01:30:00-05:00[America/Chicago]" (repeated hour; offset "prefer" keeps -05:00)
 * @example cycleZoned("2024-11-03T00:30:00-05:00[America/Chicago]", "hour", 1, { disambiguation: "reject", offset: "ignore" }) // ""
 * @example cycleZoned("2024-06-15T09:30:00-05:00[America/Chicago]", "week", 1) // "" ("week" is not a cyclable field)
 * @example cycleZoned("invalid", "hour", 1) // ""
 */
export function cycleZoned(
  value: string,
  field: DateTimeCycleField,
  amount: number,
  options?: {
    /**
     * Whether to step to the next multiple of `amount` in the direction of its sign (up for a
     * positive amount, down for a negative one) instead of adding `amount` to the current value. It
     * is the next multiple, not the nearest one; see `cycleDate` and `cycleTime` for worked examples.
     *
     * @defaultValue `false`
     */
    round?: boolean;
    /**
     * What happens when the result names a day its month does not have, such as cycling `month`
     * from 31 January to February. `"constrain"` clamps to the last valid day; `"reject"` returns
     * `""`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
    /**
     * How the new wall-clock time resolves when it falls in a DST gap or overlap and `offset` does
     * not settle it. In a fall-back overlap `"compatible"` and `"earlier"` take the earlier instant
     * and `"later"` the later one; in a spring-forward gap `"compatible"` and `"later"` move the
     * wall clock forward by the gap length and `"earlier"` back by it. `"reject"` returns `""` for
     * both.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
    /**
     * How the source's UTC offset is treated at the new wall-clock time, as in Temporal's
     * `ZonedDateTime#with`. `"prefer"` keeps it while it is still valid there (a repeated fall-back
     * hour) and otherwise resolves through `disambiguation`; `"ignore"` always resolves through
     * `disambiguation`. `"use"` keeps the offset even when that moves the wall clock, and
     * `"reject"` returns `""` when the offset is not valid for the new wall time.
     *
     * @defaultValue `"prefer"`, Temporal's default.
     */
    offset?: Offset;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (
    !isValidZonedDateTime(value) ||
    !isValidDateTimeCycleField(field) ||
    !isValidAmount(amount)
  ) {
    return "";
  }

  try {
    const zoned = zonedDateTimeFrom(value);
    const bounds = isValidDateCycleField(field)
      ? dateCycleFieldBounds(field, zoned)
      : timeCycleFieldBounds(field);
    const newValue = cycleFieldValue(
      zoned[field],
      amount,
      bounds,
      options?.round ?? false,
    );
    return setZoned(value, { [field]: newValue }, options);
  } catch {
    return "";
  }
}
