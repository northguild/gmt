// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "./isValidTime";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Return true if `value1` and `value2` form a valid time range — both parseable as
 * ISO PlainTime strings and `value1 <= value2`.
 *
 * - Both inputs must be ISO 8601 time strings (e.g. `"14:30:00"`), as `isValidTime` accepts,
 *   annotations included.
 * - Ordered by `Temporal.PlainTime.compare`, to the nanosecond.
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
export function isValidTimeRange(props: {
  value1: string;
  value2: string;
  options?: { allowEqual?: boolean };
}): boolean {
  try {
    if (!isObject(props)) return false;
    const { value1, value2, options } = props;
    if (!isOptionsArgument(options)) return false;

    if (typeof value1 !== "string" || typeof value2 !== "string") {
      return false;
    }

    if (!isValidTime(value1) || !isValidTime(value2)) {
      return false;
    }

    try {
      const time1 = Temporal.PlainTime.from(value1);
      const time2 = Temporal.PlainTime.from(value2);

      const cmp = Temporal.PlainTime.compare(time1, time2);

      if (options?.allowEqual) {
        return cmp <= 0;
      }

      return cmp < 0;
    } catch {
      return false;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
