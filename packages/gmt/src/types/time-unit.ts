import type { Temporal } from "@js-temporal/polyfill";

/**
 * A time unit in the singular, from `"hour"` down to `"nanosecond"`, as Temporal's rounding and
 * difference options name units.
 */
export type TimeUnit = Temporal.TimeUnit;
