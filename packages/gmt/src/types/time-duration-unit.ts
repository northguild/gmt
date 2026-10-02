import type { Temporal } from "@js-temporal/polyfill";

/**
 * A time field of an ISO 8601 duration, in the plural, from `"hours"` down to `"nanoseconds"`.
 * It names the unit an amount of time is given in or a time difference is measured in.
 */
export type TimeDurationUnit = keyof Pick<
  Temporal.DurationLike,
  | "hours"
  | "minutes"
  | "seconds"
  | "milliseconds"
  | "microseconds"
  | "nanoseconds"
>;
