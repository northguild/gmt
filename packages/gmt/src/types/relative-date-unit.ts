/**
 * Narrow `RelativeUnit` for `PlainDate`-based formatting. Excludes `hour`,
 * `minute`, and `second` because `PlainDate` has no time component.
 */
export type RelativeDateUnit = "year" | "month" | "week" | "day";
