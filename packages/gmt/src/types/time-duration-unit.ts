import type { Temporal } from "@js-temporal/polyfill";

export type TimeDurationUnit = keyof Pick<
  Temporal.DurationLike,
  | "hours"
  | "minutes"
  | "seconds"
  | "milliseconds"
  | "microseconds"
  | "nanoseconds"
>;
