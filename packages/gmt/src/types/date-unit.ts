import type { Temporal } from "@js-temporal/polyfill";

/**
 * A date unit in the singular: `"year"`, `"month"`, `"week"` or `"day"`, as Temporal's rounding
 * and difference options name units.
 */
export type DateUnit = Temporal.DateUnit;
