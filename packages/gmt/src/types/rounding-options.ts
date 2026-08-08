import type { Temporal } from "@js-temporal/polyfill";

// used in Temporal until()/since() methods like Temporal.PlainDate.prototype.until(other, options)
export type RoundingOptions<Unit extends Temporal.DateTimeUnit> = {
  smallestUnit?: Temporal.SmallestUnit<Unit>;
  roundingIncrement?: number;
  roundingMode?: Temporal.RoundingMode;
};
