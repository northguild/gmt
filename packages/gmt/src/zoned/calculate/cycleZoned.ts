import { Temporal } from "@js-temporal/polyfill";
import {
  cycleFieldValue,
  dateCycleFieldBounds,
  timeCycleFieldBounds,
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
 * - `disambiguation` defaults to `"compatible"` and `offset` defaults to `"ignore"` (not
 *   Temporal's own `"prefer"` default) — the same C3 precedent as `setZoned`/`startOfZoned`: with
 *   `"prefer"`, the source's still-valid offset is kept and `disambiguation` is silently never
 *   consulted. Leave `offset` at its default unless you specifically need Temporal's raw `.with()`
 *   semantics.
 * - `options.round` steps to the *next* multiple of `amount` in the direction of its sign
 *   (ceiling for positive, floor for negative) — not the nearest one. See `cycleDate`/`cycleTime`'s
 *   docs for worked examples.
 * - Returns "" for an invalid `value` or an invalid `field`.
 *
 * @param value zoned ISO 8601 datetime string
 * @param field the field to cycle: "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
 * @param amount signed amount to cycle by
 * @param options optional: round (boolean, default false), overflow ("constrain" | "reject"), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns zoned ISO 8601 string with `field` cycled, or "" on invalid input
 *
 * @example cycleZoned("2024-06-15T09:30:00-05:00[America/Chicago]", "hour", 1) // "2024-06-15T10:30:00-05:00[America/Chicago]"
 * @example cycleZoned("2024-12-15T09:30:00-06:00[America/Chicago]", "month", 1) // "2024-01-15T09:30:00-06:00[America/Chicago]" (wraps, stays in the same year)
 * @example cycleZoned("2024-03-10T01:30:00-06:00[America/Chicago]", "hour", 1) // "2024-03-10T03:30:00-05:00[America/Chicago]" (cycled hour lands in a spring-forward gap; "compatible" skips forward)
 * @example cycleZoned("2024-03-10T01:30:00-06:00[America/Chicago]", "hour", 1, { disambiguation: "reject" }) // "" (same gap; "reject" throws)
 * @example cycleZoned("2024-06-15T09:30:00-05:00[America/Chicago]", "week", 1) // "" ("week" is not a cyclable field)
 * @example cycleZoned("invalid", "hour", 1) // ""
 */
export function cycleZoned(
  value: string,
  field: DateTimeCycleField,
  amount: number,
  options?: {
    round?: boolean;
    overflow?: Overflow;
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): string {
  if (!isValidZonedDateTime(value) || !isValidDateTimeCycleField(field)) {
    return "";
  }

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
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
