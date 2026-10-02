import type { Temporal } from "@js-temporal/polyfill";

/**
 * A date field of an ISO 8601 duration, in the plural: `"years"`, `"months"`, `"weeks"` or
 * `"days"`. It names the unit an amount of dates is given in or a date difference is measured in.
 */
export type DateDurationUnit = keyof Pick<
  Temporal.DurationLike,
  "years" | "months" | "weeks" | "days"
>;
