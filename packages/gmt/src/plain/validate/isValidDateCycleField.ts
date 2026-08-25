import type { DateCycleField } from "../../types";

/**
 * Return true when `field` is a valid DateCycleField.
 *
 * - Valid fields are: "year", "month", "day".
 * - Accepts any input type and returns false for non-string values.
 * - Note "week" is a valid DateUnit elsewhere in GMT but is NOT a valid cycle field — it isn't a
 *   `.with()`-settable field, so it can't be cycled.
 *
 * @param field candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidDateCycleField("year") // true
 * @example isValidDateCycleField("month") // true
 * @example isValidDateCycleField("day") // true
 * @example isValidDateCycleField("week") // false
 * @example isValidDateCycleField("invalid") // false
 * @example isValidDateCycleField(123) // false
 * @example isValidDateCycleField(null) // false
 */
export function isValidDateCycleField(
  field: unknown,
): field is DateCycleField {
  if (typeof field !== "string") {
    return false;
  }

  return field === "year" || field === "month" || field === "day";
}
