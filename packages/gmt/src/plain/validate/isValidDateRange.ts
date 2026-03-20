import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

interface IsValidDateRangeProps {
  value1: string;
  value2: string;
  options?: {
    allowEqual?: boolean;
  };
}

export function isValidDateRange({
  value1,
  value2,
  options,
}: IsValidDateRangeProps): boolean {
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
