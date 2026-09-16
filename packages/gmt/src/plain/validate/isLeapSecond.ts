import { leapSecond } from "../../regex/leap-second";

/**
 * Return true if the provided string is a valid ISO 8601 leap second datetime.
 *
 * - Validates leap second format using regex: "YYYY-MM-DDT23:59:60Z" or "YYYY-MM-DDT23:59:60+00:00".
 * - Accepts optional fractional seconds.
 * - Accepts every spelling Temporal's grammar parses: a `T`, `t` or space separator, and
 *   extended or basic digits. Temporal silently clamps each of them to `:59`, so each is a
 *   leap second GMT has to catch. A `[key=value]` annotation value is never read as a time.
 * - Compatibility: earlier releases recognised only an uppercase `T` with extended digits. To
 *   keep that narrower test, match `/T\d{2}:\d{2}:60(?:[.,]\d+)?[-+Zz[]/` yourself.
 *
 * @param value ISO datetime string
 * @returns boolean indicating whether the input string is a valid leap second datetime
 *
 * @example isLeapSecond("2024-12-31T23:59:60Z") // true
 * @example isLeapSecond("2024-12-31T23:59:60.123Z") // true
 * @example isLeapSecond("2024-12-31T23:59:60+00:00") // true
 * @example isLeapSecond("2024-12-31T23:59:60.123+00:00") // true
 * @example isLeapSecond("2024-12-31t23:59:60Z") // true (lowercase t)
 * @example isLeapSecond("20241231 235960Z") // true (space separator, basic format)
 * @example isLeapSecond("2024-12-31T23:59:59Z") // false
 * @example /T\d{2}:\d{2}:60(?:[.,]\d+)?[-+Zz[]/.test("2024-12-31t23:59:60Z") // false (the earlier uppercase-T-only test)
 */
export function isLeapSecond(value: string): boolean {
  return leapSecond.test(value);
}
