import type { RelativeRoundingMethod } from "../types";

/**
 * Round a relative-time distance to an integer using the given method, defaulting to "round".
 *
 * Applied directly to the signed fractional value (not its absolute value), so floor/ceil
 * respect whether the distance is past (negative) or future (positive) — matches date-fns's
 * `formatDistanceStrict` `roundingMethod` semantics. A rounded `-0` is preserved rather than
 * normalized to `0`: `Intl.RelativeTimeFormat` treats the sign of zero as meaningful (with
 * `numeric: "always"`, `-0` renders as "0 <unit> ago" and `0` as "in 0 <unit>"), so collapsing
 * it here would change existing `formatRelative*` output for near-zero distances.
 *
 * @param value the fractional distance in the target display unit
 * @param method optional: "floor" | "ceil" | "round" (default "round")
 * @returns the rounded amount
 * @example resolveRelativeRounding(2.7) // 3
 * @example resolveRelativeRounding(2.7, "floor") // 2
 * @example resolveRelativeRounding(-2.7, "ceil") // -2
 */
export function resolveRelativeRounding(
  value: number,
  method: RelativeRoundingMethod = "round",
): number {
  return Math[method](value);
}
