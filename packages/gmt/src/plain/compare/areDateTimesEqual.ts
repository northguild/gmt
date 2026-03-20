import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

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
