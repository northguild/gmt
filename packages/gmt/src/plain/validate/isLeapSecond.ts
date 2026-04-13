import { leapSecond } from "../../regex/leap-second";

/**
 * Return true if the provided string is a valid ISO 8601 leap second datetime.
 * - Valid leap second datetimes have the format "YYYY-MM-DDT23:59:60Z" or "YYYY-MM-DDT23:59:60+00:00" (with optional fractional seconds).
 * - This function uses a regex to validate the leap second datetime format.
 *
 * @param value
 * @example isLeapSecond("2024-12-31T23:59:60Z") // true
 * @example isLeapSecond("2024-12-31T23:59:60.123Z") // true
 * @example isLeapSecond("2024-12-31T23:59:60+00:00") // true
 * @example isLeapSecond("2024-12-31T23:59:60.123+00:00") // true
 * @example isLeapSecond("2024-12-31T23:59:59Z") // false
 * @returns boolean indicating whether the input string is a valid leap second datetime
 */
export function isLeapSecond(value: string): boolean {
  return leapSecond.test(value);
}
