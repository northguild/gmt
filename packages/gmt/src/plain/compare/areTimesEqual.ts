import { Temporal } from "@js-temporal/polyfill";

import { isValidTime } from "../validate";

export function areTimesEqual(value1: string, value2: string): boolean {
  if (!isValidTime(value1) || !isValidTime(value2)) {
    return false;
  }

  try {
    const time1 = Temporal.PlainTime.from(value1);
    const time2 = Temporal.PlainTime.from(value2);

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
