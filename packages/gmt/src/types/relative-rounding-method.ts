// Used by the formatRelative* family — how the computed distance rounds to the display unit,
// applied to the signed fractional value (see internal/resolveRelativeRounding.ts).
export type RelativeRoundingMethod = "floor" | "ceil" | "round";
