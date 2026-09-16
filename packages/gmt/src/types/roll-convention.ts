/**
 * What `rollDate` does when a date lands on a non-business day.
 *
 * Every industry has an answer and they differ, so the convention is always explicit.
 *
 * The first four are the conventions defined by
 * [ISDA 2006 Definitions §4.12(a)](https://www.isda.org/book/2006-isda-definitions/) — the
 * text that governs them, since no TC39, ECMA or RFC standard does — and `"none"` is what
 * [OpenGamma Strata](https://strata.opengamma.io/apidocs/com/opengamma/strata/basics/date/BusinessDayConventions.html)
 * calls `NO_ADJUST`.
 *
 * - `"following"` — forward to the next business day, or the date itself if it is one.
 * - `"modifiedFollowing"` — forward, unless that crosses into the next month, then backward.
 * - `"preceding"` — backward to the previous business day, or the date itself if it is one.
 * - `"modifiedPreceding"` — backward, unless that crosses into the previous month, then forward.
 * - `"endOfMonth"` — the last business day of the date's own month, wherever in the month the
 *   date falls; it leaves the month only if that whole month is closed. **GMT's own, not
 *   ISDA's**, and not the industry "EOM rule" — that is a *schedule* rule, holding every date
 *   in a schedule to its month's last day once the anchor is one. Build that rule from this
 *   one by testing the anchor for month-end yourself and applying `"endOfMonth"` to the
 *   unadjusted target date.
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
