/**
 * A date field `cycleDate`, `cycleDateTime` and `cycleZoned` can step and wrap: `"year"`,
 * `"month"` or `"day"`. Narrower than `DateUnit` on purpose: `"week"` is a unit, not a field a
 * date can be set to with Temporal's `with()`.
 */
export type DateCycleField = "year" | "month" | "day";
