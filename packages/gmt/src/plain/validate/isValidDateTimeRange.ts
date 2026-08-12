import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return true if `value1` and `value2` form a valid datetime range — both parseable as
 * ISO PlainDateTime strings and `value1 <= value2`.
 *
 * - Both inputs must be ISO 8601 datetime strings (e.g. `"2024-01-01T10:00:00"`).
 * - Equal `value1 === value2` is valid when `options.allowEqual` is true.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param value1 first ISO PlainDateTime string
 * @param value2 second ISO PlainDateTime string
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the datetime range is valid
 *
 * @example isValidDateTimeRange({ value1: "2024-01-01T10:00:00", value2: "2024-12-31T23:59:59" }) // true
 * @example isValidDateTimeRange({ value1: "2024-12-31T23:59:59", value2: "2024-01-01T10:00:00" }) // false
 * @example isValidDateTimeRange({ value1: "2024-01-01T10:00:00", value2: "2024-01-01T10:00:00", options: { allowEqual: true } }) // true
 */
export function isValidDateTimeRange({
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

  if (!plainDateTime.test(value1) || !plainDateTime.test(value2)) {
    return false;
  }

  try {
    const dt1 = Temporal.PlainDateTime.from(value1);
    const dt2 = Temporal.PlainDateTime.from(value2);

    const cmp = Temporal.PlainDateTime.compare(dt1, dt2);

    if (options?.allowEqual) {
      return cmp <= 0;
    }

    return cmp < 0;
  } catch {
    return false;
  }
}
