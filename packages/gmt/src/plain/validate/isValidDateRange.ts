import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";
import { isObject } from "../../internal/isObject";

/**
 * The argument object of `isValidDateRange`.
 *
 * @example
 * import { IsValidDateRangeProps } from "@northguild/gmt/plain";
 * const range: IsValidDateRangeProps = { value1: "2024-02-28", value2: "2024-02-29" };
 */
export interface IsValidDateRangeProps {
  value1: string;
  value2: string;
  options?: { allowEqual?: boolean };
}

/**
 * Return whether `value1` is before `value2`.
 *
 * - Validates both dates using regex and Temporal.PlainDate.from().
 * - Rejects leap seconds in either date.
 * - When `options.allowEqual` is true, equality is considered valid as well.
 *
 * @param value1 first ISO PlainDate string
 * @param value2 second ISO PlainDate string
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the date range is valid
 *
 * @example isValidDateRange({ value1: "2024-02-28", value2: "2024-02-29" }) // true
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-28" }) // false
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-29" }) // false
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-29", options: { allowEqual: true } }) // true
 */
export function isValidDateRange(props: IsValidDateRangeProps): boolean {
  if (!isObject(props)) return false;
  const { value1, value2, options } = props;

  if (isLeapSecond(value1) || isLeapSecond(value2)) {
    return false;
  }

  if (!plainDate.test(value1) || !plainDate.test(value2)) {
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
}
