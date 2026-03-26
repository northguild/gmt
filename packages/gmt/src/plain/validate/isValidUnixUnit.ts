export type UnixUnit = "seconds" | "milliseconds";

/**
 * Return true when `unit` is a valid UnixUnit.
 *
 * @param unit string candidate
 * @returns boolean indicating whether the unit is a valid UnixUnit
 */
export function isValidUnixUnit(unit: string): unit is UnixUnit {
  return unit === "seconds" || unit === "milliseconds";
}
