import type { Temporal } from "@js-temporal/polyfill";

/**
 * How a difference is rounded, as the rounding options of Temporal's `until()` and `since()`
 * (`Temporal.PlainDate.prototype.until(other, options)`). `Unit` is the set of units the values
 * being compared have: date units for dates, time units for times.
 */
export type RoundingOptions<Unit extends Temporal.DateTimeUnit> = {
  /**
   * The smallest unit kept in the difference; anything smaller is rounded into it. It may not be
   * larger than the largest unit asked for.
   *
   * @defaultValue None. The difference is not rounded: Temporal uses the smallest unit the
   * values have, `"day"` for dates and `"nanosecond"` otherwise.
   */
  smallestUnit?: Temporal.SmallestUnit<Unit>;
  /**
   * The step the smallest unit is rounded to, so `15` with `"minute"` rounds to a quarter of an
   * hour. For a time unit it must divide the next larger unit evenly and be smaller than it (`15`
   * or `30` minutes, not `7` or `60`); a date unit takes any whole number from 1 up. A non-integer
   * is truncated first, as Temporal does, and any other value is invalid input.
   *
   * @defaultValue `1`, Temporal's default.
   */
  roundingIncrement?: number;
  /**
   * Which way a value between two steps goes. `"trunc"` rounds toward zero and `"halfExpand"` to
   * the nearest step, a half going away from zero; the other modes are those of Temporal's
   * `roundingMode` option.
   *
   * @defaultValue `"trunc"`, Temporal's default for a difference.
   */
  roundingMode?: Temporal.RoundingMode;
};
