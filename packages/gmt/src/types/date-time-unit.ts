import type { Temporal } from "../internal/temporal";

/**
 * A date or time unit in the singular, from `"year"` down to `"nanosecond"`, as Temporal's
 * rounding and difference options name units.
 */
export type DateTimeUnit = Temporal.TimeUnit | Temporal.DateUnit;
