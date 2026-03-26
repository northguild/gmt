import type { Temporal } from "@js-temporal/polyfill";

export type DateDurationUnit = keyof Pick<
  Temporal.DurationLike,
  "years" | "months" | "weeks" | "days"
>;
