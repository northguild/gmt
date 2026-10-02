import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "./isValidDate";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * The argument object of `isValidDateRange`.
 *
 * @example
 * import { IsValidDateRangeProps } from "@northguild/gmt/plain";
 * const range: IsValidDateRangeProps = { value1: "2024-02-28", value2: "2024-02-29" };
 */
export interface IsValidDateRangeProps {
  /**
   * The start of the range, an ISO PlainDate string.
   */
  value1: string;
  /**
   * The end of the range, an ISO PlainDate string.
   */
  value2: string;
  /**
   * The settings for the comparison. It must be an object or omitted; any other value, `null`
   * included, returns false.
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
}

/**
 * Return whether `value1` is before `value2`.
 *
 * - Validates both dates with `isValidDate`, so each endpoint's RFC 9557 annotations are read as
 *   `Temporal.PlainDate.from` reads them (an elective `[foo=bar]` or `[u-ca=iso8601]` is ignored).
 * - Rejects leap seconds in either date.
 *
 * @param props The two values to compare and how equal values are treated
 * @returns boolean indicating whether the date range is valid
 *
 * @example isValidDateRange({ value1: "2024-02-28", value2: "2024-02-29" }) // true
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-28" }) // false
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-29" }) // false
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-29", options: { allowEqual: true } }) // true
 */
export function isValidDateRange(props: IsValidDateRangeProps): boolean {
  try {
    if (!isObject(props)) return false;
    const { value1, value2, options } = props;
    if (!isOptionsArgument(options)) return false;

    if (!isValidDate(value1) || !isValidDate(value2)) {
      return false;
    }

    try {
      const date1 = Temporal.PlainDate.from(value1);
      const date2 = Temporal.PlainDate.from(value2);

      const isLessThan =
        date1.year < date2.year ||
        (date1.year === date2.year && date1.month < date2.month) ||
        (date1.year === date2.year &&
          date1.month === date2.month &&
          date1.day < date2.day);

      const isEqual =
        date1.year === date2.year &&
        date1.month === date2.month &&
        date1.day === date2.day;

      if (options?.allowEqual) {
        return isLessThan || isEqual;
      }

      return isLessThan;
    } catch {
      return false;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
