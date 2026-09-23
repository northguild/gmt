import type { FractionalDigit } from "../types";

/** Sub-second units to the fractional digits that show them; every other unit shows none. */
const DIGITS_BY_UNIT: Readonly<Record<string, FractionalDigit>> = {
  millisecond: 3,
  microsecond: 6,
  nanosecond: 9,
};

/**
 * Resolve how many fractional second digits a result snapped to `unit` is printed with.
 *
 * - An explicit `fractionalSecondDigits` always wins — including an invalid one, which Temporal's
 *   `toString` then rejects, so the caller returns its sentinel. Only an omitted member defaults.
 * - Otherwise 3 for "millisecond", 6 for "microsecond", 9 for "nanosecond", and 0 for anything
 *   coarser (or unrecognised), so the output never hides the precision the unit asked for.
 *
 * @param unit the unit the value was snapped or rounded to
 * @param fractionalSecondDigits optional caller-supplied override
 * @returns the digit count to pass to `toString({ fractionalSecondDigits })`
 */
export function defaultFractionalDigits(
  unit: string,
  fractionalSecondDigits?: FractionalDigit,
): FractionalDigit {
  return fractionalSecondDigits === undefined
    ? (DIGITS_BY_UNIT[unit] ?? 0)
    : fractionalSecondDigits;
}
