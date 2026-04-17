import { leapSecond } from "../../regex/leap-second";

/**
 * Return true if the provided string is a valid ISO 8601 leap second datetime.
 *
 * - Validates leap second format using regex: "YYYY-MM-DDT23:59:60Z" or "YYYY-MM-DDT23:59:60+00:00".
 * - Accepts optional fractional seconds.
 *
 * @param value ISO datetime string
 * @returns boolean indicating whether the input string is a valid leap second datetime
 *
 * @example isLeapSecond("2024-12-31T23:59:60Z") // true
 * @example isLeapSecond("2024-12-31T23:59:60.123Z") // true
 * @example isLeapSecond("2024-12-31T23:59:60+00:00") // true
 * @example isLeapSecond("2024-12-31T23:59:60.123+00:00") // true
 * @example isLeapSecond("2024-12-31T23:59:59Z") // false
 */
export function isLeapSecond(value: string): boolean {
  return leapSecond.test(value);
}
