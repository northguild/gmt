import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return whether `value1` represents an instant strictly before `value2`.
 *
 * - Both inputs must be valid UTC ISO 8601 datetime strings (ending in Z).
 * - Comparison is performed using Temporal.Instant (same instant semantics),
 *   so differing representations of the same instant will compare as equal.
 * - Invalid inputs return `false`.
 *
 * @param value1 first UTC datetime string
 * @param value2 second UTC datetime string
 * @example isBeforeUtc("2024-03-17T14:30:45Z", "2024-03-17T15:30:45Z") // true
 * @example isBeforeUtc("2024-03-17T14:30:45Z", "2024-03-17T14:30:45Z") // false
 * @example isBeforeUtc("2024-03-17T15:30:45Z", "2024-03-17T14:30:45Z") // false
 * @returns `true` if `value1` is before `value2`, otherwise `false`
 */
export function isBeforeUtc(value1: string, value2: string): boolean {
  if (!isValidUtc(value1) || !isValidUtc(value2)) {
    return false;
  }

  let instant1: Temporal.Instant;
  let instant2: Temporal.Instant;

  try {
    instant1 = Temporal.Instant.from(value1);
    instant2 = Temporal.Instant.from(value2);
  } catch {
    return false;
  }

  try {
    return Temporal.Instant.compare(instant1, instant2) === -1;
  } catch {
    return false;
  }
}
