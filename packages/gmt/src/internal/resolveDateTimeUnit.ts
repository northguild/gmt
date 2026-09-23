import { isValidDateTimeUnit } from "../plain/validate/isValidDateTimeUnit";

/**
 * Normalize a date-time unit string to its singular form.
 *
 * - Accepts singular ("day"), plural ("days"), and already-singular forms.
 * - Returns the original string if it is not a recognized DateTimeUnit.
 * - Returns a non-string input unchanged, so callers can pass raw option values and let their own
 *   validator reject them (Temporal §13.17 GetTemporalUnitValuedOption accepts both spellings).
 * - Singular counterpart of `resolveDurationUnit`, which normalizes to plurals.
 *
 * @param unit raw unit value from caller input
 * @returns normalized singular unit string, or the original if not recognized
 */
export function resolveDateTimeUnit(unit: string): string;
export function resolveDateTimeUnit(unit: unknown): unknown;
export function resolveDateTimeUnit(unit: unknown): unknown {
  if (typeof unit !== "string" || isValidDateTimeUnit(unit)) {
    return unit;
  }

  if (unit.endsWith("s")) {
    const singular = unit.slice(0, -1);

    if (isValidDateTimeUnit(singular)) {
      return singular;
    }
  }

  return unit;
}
