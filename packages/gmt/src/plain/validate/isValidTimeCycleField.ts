import type { TimeCycleField } from "../../types";

/**
 * Return true when `field` is a valid TimeCycleField.
 *
 * - Valid fields are: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Accepts any input type and returns false for non-string values.
 *
 * @param field candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidTimeCycleField("hour") // true
 * @example isValidTimeCycleField("nanosecond") // true
 * @example isValidTimeCycleField("year") // false
 * @example isValidTimeCycleField("invalid") // false
 * @example isValidTimeCycleField(123) // false
 * @example isValidTimeCycleField(null) // false
 */
export function isValidTimeCycleField(
  field: unknown,
): field is TimeCycleField {
  if (typeof field !== "string") {
    return false;
  }

  return (
    field === "hour" ||
    field === "minute" ||
    field === "second" ||
    field === "millisecond" ||
    field === "microsecond" ||
    field === "nanosecond"
  );
}
