import { isValidDateTimeUnit } from "../plain/validate";

/**
 * Normalize a date-time unit string to its singular form.
 *
 * - Accepts singular ("day"), plural ("days"), and already-singular forms.
 * - Returns the original string if it is not a recognized DateTimeUnit.
 * - Singular counterpart of `resolveDurationUnit`, which normalizes to plurals.
 *
 * @param unit raw unit string from caller input
 * @returns normalized singular unit string, or the original if not recognized
 */
export function resolveDateTimeUnit(unit: string): string {
  if (isValidDateTimeUnit(unit)) {
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
