/**
 * Full 7-member `RelativeUnit` for `PlainDateTime`-based formatting. Covers the
 * complete set of `Intl.RelativeTimeFormat` units supported by Temporal, excluding
 * `quarter`.
 */
export type RelativeDateTimeUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";
