import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return whether `value1` and `value2` represent the same instant.
 *
 * - Uses Temporal.Instant.compare for equality check.
 * - Returns false if either input is invalid.
 *
 * @param value1 first UTC datetime string
 * @param value2 second UTC datetime string
 * @returns `true` if `value1` equals `value2`, otherwise `false`
 *
 * @example areUtcEqual("2024-03-17T14:30:45Z", "2024-03-17T14:30:45Z") // true
 * @example areUtcEqual("2024-03-17T14:30:45Z", "2024-03-17T14:30:44Z") // false
 * @example areUtcEqual("2024-03-17T14:30:45Z", "invalid") // false
 */
export function areUtcEqual(value1: string, value2: string): boolean {
  if (!isValidUtc(value1) || !isValidUtc(value2)) {
    return false;
  }

  try {
    const instant1 = Temporal.Instant.from(value1);
    const instant2 = Temporal.Instant.from(value2);
    return Temporal.Instant.compare(instant1, instant2) === 0;
  } catch {
    return false;
  }
}
