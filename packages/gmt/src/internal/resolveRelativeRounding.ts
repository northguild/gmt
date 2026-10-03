import type { RelativeRoundingMethod } from "../types";

/**
 * Round a relative-time distance to an integer using the given method, defaulting to "round".
 *
 * Applied directly to the signed fractional value (not its absolute value), so floor/ceil
 * respect whether the distance is past (negative) or future (positive): "floor" rounds toward
 * negative infinity and "ceil" toward positive infinity, as ECMA-262 `Math.floor` / `Math.ceil`
 * and Temporal's rounding modes of the same names do. "round" is ECMA-262 `Math.round`, a half
 * going toward positive infinity. Comparison: date-fns's `formatDistanceStrict` `roundingMethod`
 * rounds the unsigned distance, so its floor and ceil differ for a past value.
 *
 * A rounded `-0` is preserved rather than normalized to `0`: `Intl.RelativeTimeFormat` treats the
 * sign of zero as meaningful (with `numeric: "always"`, `-0` renders as "0 <unit> ago" and `0` as
 * "in 0 <unit>"), so collapsing it here would change existing `formatRelative*` output for
 * near-zero distances.
 *
 * The method is matched against the three names `RelativeRoundingMethod` lists, never looked up on
 * `Math`: `Math.abs`, `Math.trunc`, `Math.random` and the keys `Math` inherits from
 * `Object.prototype` are not rounding methods. An `undefined` method is the omitted option
 * (ECMA-402 `GetOption`, which the Temporal specification also defines) and takes the default.
 *
 * @param value the fractional distance in the target display unit
 * @param method optional: "floor" | "ceil" | "round" (default "round")
 * @returns the rounded amount; throws RangeError for any other method, for the caller's sentinel
 * @example resolveRelativeRounding(2.7) // 3
 * @example resolveRelativeRounding(2.7, "floor") // 2
 * @example resolveRelativeRounding(-2.7, "ceil") // -2
 * @example resolveRelativeRounding(-2.7, "abs" as never) // throws RangeError
 */
export function resolveRelativeRounding(
  value: number,
  method: RelativeRoundingMethod = "round",
): number {
  switch (method) {
    case "floor":
      return Math.floor(value);
    case "ceil":
      return Math.ceil(value);
    case "round":
      return Math.round(value);
    default:
      throw new RangeError(`Invalid roundingMethod: ${String(method)}`);
  }
}
