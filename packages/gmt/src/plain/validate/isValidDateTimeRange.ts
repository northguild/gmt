// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { plainDateTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Return true if `value1` and `value2` form a valid datetime range — both parseable as
 * ISO PlainDateTime strings and `value1` before `value2`.
 *
 * - Both inputs must be ISO 8601 datetime strings (e.g. `"2024-01-01T10:00:00"`), as
 *   `isValidDateTime` accepts, annotations included.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param props The two values to compare and how equal values are treated
 * @returns boolean indicating whether the datetime range is valid
 *
 * @example isValidDateTimeRange({ value1: "2024-01-01T10:00:00", value2: "2024-12-31T23:59:59" }) // true
 * @example isValidDateTimeRange({ value1: "2024-12-31T23:59:59", value2: "2024-01-01T10:00:00" }) // false
 * @example isValidDateTimeRange({ value1: "2024-01-01T10:00:00", value2: "2024-01-01T10:00:00", options: { allowEqual: true } }) // true
 */
export function isValidDateTimeRange(props: {
  /**
   * The start of the range, an ISO PlainDateTime string.
   */
  value1: string;
  /**
   * The end of the range, an ISO PlainDateTime string.
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

    const dt1 = plainDateTimeOf(value1);

    const dt2 = dt1 === null ? null : plainDateTimeOf(value2);

    if (dt1 === null || dt2 === null) {
      return false;
    }

    try {
      const cmp = Temporal.PlainDateTime.compare(dt1, dt2);

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
