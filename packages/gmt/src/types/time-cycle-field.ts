/**
 * A time field `cycleTime`, `cycleDateTime` and `cycleZoned` can step and wrap, from `"hour"`
 * down to `"nanosecond"`: the fields of Temporal's `PlainTime`.
 */
export type TimeCycleField =
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond";
