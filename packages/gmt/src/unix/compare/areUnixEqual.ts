import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return whether `value1` and `value2` represent the same instant.
 *
 * - Both inputs must be valid unix epoch numbers.
 * - Comparison is performed using Temporal.Instant (same instant semantics).
 * - Invalid inputs return `false`.
 *
 * @param value1 first unix epoch value
 * @param value2 second unix epoch value
 * @param options epoch unit and options
 * @example areUnixEqual(1706659200, 1706659200) // true
 * @example areUnixEqual(1706659200, 1704067200) // false
 * @returns `true` if `value1` and `value2` are equal, otherwise `false`
 */
export function areUnixEqual(
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

    return Temporal.Instant.compare(instant1, instant2) === 0;
  } catch {
    return false;
  }
}
