import type { Temporal } from "@js-temporal/polyfill";

/**
 * Any field of an ISO 8601 duration, in the plural, from `"years"` down to `"nanoseconds"`. It
 * names the unit an amount of time is given in or a difference is measured in.
 */
export type DateTimeDurationUnit = keyof Temporal.DurationLike;
