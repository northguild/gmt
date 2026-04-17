export type UnixUnit = "seconds" | "milliseconds";

/**
 * Return true when `unit` is a valid UnixUnit.
 *
 * - Valid units are: "seconds", "milliseconds".
 * - Accepts any input type and returns false for non-string values.
 * - Uses type assertion to narrow the type.
 *
 * @param unit candidate value of any type
 * @returns boolean indicating whether the unit is a valid UnixUnit
 *
 * @example isValidUnixUnit("seconds") // true
 * @example isValidUnixUnit("milliseconds") // true
 * @example isValidUnixUnit("invalid") // false
 * @example isValidUnixUnit(123) // false
 * @example isValidUnixUnit(null) // false
 */
export function isValidUnixUnit(unit: unknown): unit is UnixUnit {
  if (typeof unit !== "string") {
    return false;
  }

  return unit === "seconds" || unit === "milliseconds";
}
