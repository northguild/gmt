import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return whether `value1` represents an instant strictly after `value2`.
 *
 * - Both inputs must be valid unix epoch numbers.
 * - Comparison is performed using Temporal.Instant (same instant semantics).
 * - Invalid inputs return `false`.
 *
 * @param value1 first unix epoch value
 * @param value2 second unix epoch value
 * @param options epoch unit and options
 * @example isAfterUnix(1706659200, 1704067200) // true
 * @example isAfterUnix(1706659200, 1706659200) // false
 * @returns `true` if `value1` is after `value2`, otherwise `false`
 */
export function isAfterUnix(
  value1: number,
  value2: number,
  options?: {
    epochUnit?: UnixUnit;
  },
): boolean {
  const epochUnit = options?.epochUnit ?? "milliseconds";

  if (!isValidAmount(value1) || !isValidAmount(value2)) {
    return false;
  }

  try {
    const instant1 = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value1 * 1000 : value1,
    );
    const instant2 = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value2 * 1000 : value2,
    );

    return Temporal.Instant.compare(instant1, instant2) === 1;
  } catch {
    return false;
  }
}
