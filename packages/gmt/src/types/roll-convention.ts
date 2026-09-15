/**
 * What `rollDate` does when a date lands on a non-business day.
 *
 * Every industry has an answer and they differ, so the convention is always explicit.
 *
 * - `"following"` — forward to the next business day, or the date itself if it is one.
 * - `"modifiedFollowing"` — forward, unless that crosses into the next month, then backward.
 *   The common convention for interest-rate instruments.
 * - `"preceding"` — backward to the previous business day, or the date itself if it is one.
 * - `"modifiedPreceding"` — backward, unless that crosses into the previous month, then forward.
 * - `"endOfMonth"` — the last business day of the date's own month, wherever in the month the
 *   date falls.
 * - `"none"` — return the date unadjusted, business day or not.
 *
 * Narrow a candidate with `isValidRollConvention`.
 */
export type RollConvention =
  | "following"
  | "modifiedFollowing"
  | "preceding"
  | "modifiedPreceding"
  | "endOfMonth"
  | "none";
