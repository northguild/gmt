import type { Temporal } from "@js-temporal/polyfill";

// used in Temporal until()/since() methods like Temporal.PlainDate.prototype.until(other, options)
export type RoundingOptions<Unit extends Temporal.DateTimeUnit> = {
  smallestUnit?: Temporal.SmallestUnit<Unit>;
  roundingIncrement?: number;
  roundingMode?: Temporal.RoundingMode;
};

// Options for rounding a standalone time-of-day value via Temporal.PlainTime.prototype.round
// or Temporal.PlainDateTime.prototype.round. Only time-granular units apply (hour through nanosecond).
export type TimeRoundingOptions = {
  smallestUnit: Temporal.SmallestUnit<
    "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
  >;
  roundingIncrement?: number;
  roundingMode?: Temporal.RoundingMode;
};
