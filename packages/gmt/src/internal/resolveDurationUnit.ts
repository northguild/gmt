import { isValidDateTimeDurationUnit } from "../plain/validate";

/**
 * Normalize a duration unit string to its plural form.
 *
 * - Accepts singular ("day"), plural ("days"), and already-plural forms.
 * - Returns the original string if it is not a recognized DateTimeDurationUnit.
 *
 * @param unit raw unit string from caller input
 * @returns normalized plural unit string, or the original if not recognized
 */
export function resolveDurationUnit(unit: string): string {
  if (isValidDateTimeDurationUnit(unit)) {
    return unit;
  }

  if (unit.endsWith("s")) {
    return unit;
  }

  const plural = `${unit}s`;
  if (isValidDateTimeDurationUnit(plural)) {
    return plural;
  }

  return unit;
}
