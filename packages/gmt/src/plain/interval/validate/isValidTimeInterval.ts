import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../../regex";

/**
 * Return true if `start` and `end` form a valid time interval — both parseable as
 * ISO PlainTime strings and `start <= end`.
 *
 * - Both inputs must be ISO 8601 time strings (e.g. `"14:30:00"`).
 * - Equal `start === end` is valid.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param start ISO 8601 time string (interval start)
 * @param end ISO 8601 time string (interval end)
 * @returns true if start and end form a valid time interval, or false on invalid input
 *
 * @example isValidTimeInterval("09:00:00", "17:00:00") // true
 * @example isValidTimeInterval("12:00:00", "12:00:00") // true
 * @example isValidTimeInterval("17:00:00", "09:00:00") // false
 * @example isValidTimeInterval("invalid", "12:00:00") // false
 */
export function isValidTimeInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!plainTime.test(start) || !plainTime.test(end)) {
    return false;
  }

  try {
    const t1 = Temporal.PlainTime.from(start);
    const t2 = Temporal.PlainTime.from(end);

    const isLessThan =
      t1.hour < t2.hour ||
      (t1.hour === t2.hour && t1.minute < t2.minute) ||
      (t1.hour === t2.hour &&
        t1.minute === t2.minute &&
        t1.second < t2.second) ||
      (t1.hour === t2.hour &&
        t1.minute === t2.minute &&
        t1.second === t2.second &&
        t1.millisecond < t2.millisecond);

    const isEqual =
      t1.hour === t2.hour &&
      t1.minute === t2.minute &&
      t1.second === t2.second &&
      t1.millisecond === t2.millisecond;

    return isLessThan || isEqual;
  } catch {
    return false;
  }
}
