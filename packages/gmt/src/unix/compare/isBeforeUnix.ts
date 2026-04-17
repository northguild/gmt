import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return whether `value1` represents an instant strictly before `value2`.
 *
 * - Uses Temporal.Instant.compare to check ordering.
 * - Returns false if either input is invalid.
 *
 * @param value1 first unix epoch value
 * @param value2 second unix epoch value
 * @param options optional: epochUnit ("seconds" | "milliseconds")
 * @returns `true` if `value1` is before `value2`, otherwise `false`
 *
 * @example isBeforeUnix(1704067200, 1706659200) // true
 * @example isBeforeUnix(1706659200, 1706659200) // false
 * @example isBeforeUnix(-1, 0) // true (1969-12-31T23:59:59.999Z is before 1970-01-01T00:00:00Z)
 * @example isBeforeUnix('invalid', 1704067200000) // false
 * @example isBeforeUnix(1704067200000, 'invalid') // false
 */
export function isBeforeUnix(
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

    return Temporal.Instant.compare(instant1, instant2) === -1;
  } catch {
    return false;
  }
}
