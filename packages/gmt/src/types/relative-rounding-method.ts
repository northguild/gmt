/**
 * How the `formatRelative*` functions round a fractional distance to a whole number of the unit
 * displayed. It is applied to the signed value, where a past distance is negative: `"floor"`
 * rounds toward negative infinity, `"ceil"` toward positive infinity, and `"round"` to the nearest
 * whole number, a half going toward positive infinity.
 */
export type RelativeRoundingMethod = "floor" | "ceil" | "round";
