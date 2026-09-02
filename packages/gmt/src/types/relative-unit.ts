/**
 * Canonical 7-member unit for `Intl.RelativeTimeFormat` and Temporal `since`/`until`
 * totals, excluding `quarter`. Shared by `formatRelativeUnix`, `formatRelativeUtc`,
 * and `formatRelativeZoned` after importing from this barrel.
 */
export type RelativeUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";
