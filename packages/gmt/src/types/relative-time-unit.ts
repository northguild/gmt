/**
 * Narrow `RelativeUnit` for `PlainTime`-based formatting. Excludes date units
 * (`year`, `month`, `week`, `day`) because `PlainTime` has no date component.
 */
export type RelativeTimeUnit = "hour" | "minute" | "second";
