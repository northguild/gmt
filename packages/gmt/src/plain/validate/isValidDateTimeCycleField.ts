import type { DateTimeCycleField } from "../../types";
import { isValidDateCycleField } from "./isValidDateCycleField";
import { isValidTimeCycleField } from "./isValidTimeCycleField";

/**
 * Return true when `field` is a valid DateTimeCycleField (a valid DateCycleField or
 * TimeCycleField). Used by `cycleDateTime` and `cycleZoned`, which can cycle either kind of field.
 *
 * @param field candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidDateTimeCycleField("year") // true
 * @example isValidDateTimeCycleField("hour") // true
 * @example isValidDateTimeCycleField("week") // false
 * @example isValidDateTimeCycleField("invalid") // false
 * @example isValidDateTimeCycleField(123) // false
 * @example isValidDateTimeCycleField(null) // false
 */
export function isValidDateTimeCycleField(
  field: unknown,
): field is DateTimeCycleField {
  return isValidDateCycleField(field) || isValidTimeCycleField(field);
}
