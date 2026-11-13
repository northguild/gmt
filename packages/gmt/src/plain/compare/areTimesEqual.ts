import { plainTimeOf } from "../../internal/inputChecks";

/**
 * Return true if two PlainTime ISO strings represent the same time components.
 *
 * - Compares all time components: hour, minute, second, millisecond, microsecond, nanosecond.
 * - Returns false if either input is invalid.
 *
 * @param value1 first ISO PlainTime string
 * @param value2 second ISO PlainTime string
 * @returns boolean indicating whether both times are equal component-wise
 *
 * @example areTimesEqual("12:34:56", "12:34:56") // true
 * @example areTimesEqual("12:34:56", "12:34:57") // false
 * @example areTimesEqual("12:34:56.789", "12:34:56.789") // true
 * @example areTimesEqual("12:34:56.789", "12:34:56.790") // false
 * @example areTimesEqual("invalid", "12:34:56") // false
 * @example areTimesEqual("12:34:56", "invalid") // false
 */
export function areTimesEqual(value1: string, value2: string): boolean {
  const time1 = plainTimeOf(value1);
  const time2 = plainTimeOf(value2);
  if (time1 === null || time2 === null) {
    return false;
  }

  try {
    return (
      time1.hour === time2.hour &&
      time1.minute === time2.minute &&
      time1.second === time2.second &&
      time1.millisecond === time2.millisecond &&
      time1.microsecond === time2.microsecond &&
      time1.nanosecond === time2.nanosecond
    );
  } catch {
    return false;
  }
}
