import type { Temporal } from "../internal/temporal";

/**
 * The plural name of a duration field that has an exact length: `"days"`, or a time field from
 * `"hours"` down to `"nanoseconds"`. A day is 24 hours when nothing anchors it, as
 * TC39 Temporal's `Duration.prototype.total` reads one without `relativeTo`. Years, months and
 * weeks are left out: Temporal gives them no length without a date to measure from.
 */
export type ExactDurationUnit = keyof Pick<
  Temporal.DurationLike,
  | "days"
  | "hours"
  | "minutes"
  | "seconds"
  | "milliseconds"
  | "microseconds"
  | "nanoseconds"
>;
