import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

interface IsValidDateRangeProps {
  value1: string;
  value2: string;
  options?: {
    allowEqual?: boolean;
  };
}

/**
 * Return whether `value1` is before `value2`. If `options.allowEqual` is
 * true then equality is considered valid as well.
 *
 * - Validates both inputs using regex and Temporal.PlainDate.from.
 * - Rejects leap-second inputs explicitly.
 * - Returns false for invalid inputs or on error.
 *
 * @param value1 first ISO PlainDate string
 * @param value2 second ISO PlainDate string
 * @param options optional allowEqual flag
 * @example isValidDateRange({ value1: "2024-02-28", value2: "2024-02-29" }) => true
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-28" }) => false
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-29" }) => false
 * @example isValidDateRange({ value1: "2024-02-29", value2: "2024-02-29", options: { allowEqual: true } }) => true
 * @returns boolean indicating whether the date range is valid
 */
export function isValidDateRange({
  value1,
  value2,
  options,
}: IsValidDateRangeProps): boolean {
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
