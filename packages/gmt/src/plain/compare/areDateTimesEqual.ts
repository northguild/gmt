import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return true if two PlainDateTime ISO strings represent the same instant of local date/time components.
 *
 * - Compares all date and time components.
 * - Returns false if either input is invalid.
 *
 * @param value1 first ISO PlainDateTime string
 * @param value2 second ISO PlainDateTime string
 * @returns boolean indicating whether both date-times are equal component-wise
 *
 * @example areDateTimesEqual("2024-02-29T12:34:56", "2024-02-29T12:34:56") // true
 * @example areDateTimesEqual("2024-02-29T12:34:56", "2024-02-29T12:34:57") // false
 * @example areDateTimesEqual("2024-02-29T12:34:56", "invalid") // false
 */
export function areDateTimesEqual(value1: string, value2: string): boolean {
  if (!isValidDateTime(value1) || !isValidDateTime(value2)) {
    return false;
  }

  try {
    const dateTime1 = Temporal.PlainDateTime.from(value1);
    const dateTime2 = Temporal.PlainDateTime.from(value2);

    return (
      dateTime1.year === dateTime2.year &&
      dateTime1.month === dateTime2.month &&
      dateTime1.day === dateTime2.day &&
      dateTime1.hour === dateTime2.hour &&
      dateTime1.minute === dateTime2.minute &&
      dateTime1.second === dateTime2.second &&
      dateTime1.millisecond === dateTime2.millisecond &&
      dateTime1.microsecond === dateTime2.microsecond &&
      dateTime1.nanosecond === dateTime2.nanosecond
    );
  } catch {
    return false;
  }
}
