import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return true if `value1` and `value2` form a valid time range — both parseable as
 * ISO PlainTime strings and `value1 <= value2`.
 *
 * - Both inputs must be ISO 8601 time strings (e.g. `"14:30:00"`).
 * - Equal `value1 === value2` is valid when `options.allowEqual` is true.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param value1 first ISO PlainTime string
 * @param value2 second ISO PlainTime string
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the time range is valid
 *
 * @example isValidTimeRange({ value1: "09:00:00", value2: "17:00:00" }) // true
 * @example isValidTimeRange({ value1: "17:00:00", value2: "09:00:00" }) // false
 * @example isValidTimeRange({ value1: "12:00:00", value2: "12:00:00", options: { allowEqual: true } }) // true
 */
export function isValidTimeRange({
  value1,
  value2,
  options,
}: {
  value1: string;
  value2: string;
  options?: { allowEqual?: boolean };
}): boolean {
  if (typeof value1 !== "string" || typeof value2 !== "string") {
    return false;
  }

  if (!plainTime.test(value1) || !plainTime.test(value2)) {
    return false;
  }

  try {
    const time1 = Temporal.PlainTime.from(value1);
    const time2 = Temporal.PlainTime.from(value2);

    const isLessThan =
      time1.hour < time2.hour ||
      (time1.hour === time2.hour && time1.minute < time2.minute) ||
      (time1.hour === time2.hour &&
        time1.minute === time2.minute &&
        time1.second < time2.second) ||
      (time1.hour === time2.hour &&
        time1.minute === time2.minute &&
        time1.second === time2.second &&
        time1.millisecond < time2.millisecond);

    const isEqual =
      time1.hour === time2.hour &&
      time1.minute === time2.minute &&
      time1.second === time2.second &&
      time1.millisecond === time2.millisecond;

    if (options?.allowEqual) {
      return isLessThan || isEqual;
    }

    return isLessThan;
  } catch {
    return false;
  }
}
