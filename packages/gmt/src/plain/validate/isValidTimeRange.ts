// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "./isValidTime";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Return true if `value1` and `value2` form a valid time range — both parseable as
 * ISO PlainTime strings and `value1` before `value2`.
 *
 * - Both inputs must be ISO 8601 time strings (e.g. `"14:30:00"`), as `isValidTime` accepts,
 *   annotations included.
 * - Ordered by `Temporal.PlainTime.compare`, to the nanosecond.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param props The two values to compare and how equal values are treated
 * @returns boolean indicating whether the time range is valid
 *
 * @example isValidTimeRange({ value1: "09:00:00", value2: "17:00:00" }) // true
 * @example isValidTimeRange({ value1: "17:00:00", value2: "09:00:00" }) // false
 * @example isValidTimeRange({ value1: "12:00:00", value2: "12:00:00", options: { allowEqual: true } }) // true
 */
export function isValidTimeRange(props: {
  /**
   * The start of the range, an ISO PlainTime string.
   */
  value1: string;
  /**
   * The end of the range, an ISO PlainTime string.
   */
  value2: string;
  /**
   * The settings for the comparison. It must be an object or omitted; any other value, `null`
   * included, returns `false`.
   *
   * @defaultValue None. Equal values are not a valid range.
   */
  options?: {
    /**
     * Whether `value1` equal to `value2` is a valid range. `false` requires `value1` to be
     * before `value2`.
     *
     * @defaultValue `false`
     */
    allowEqual?: boolean;
  };
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
