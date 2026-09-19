import { isValidDateTimeDurationUnit } from "../plain/validate/isValidDateTimeDurationUnit";

/**
 * Normalize a duration unit string to its plural form.
 *
 * - Accepts singular ("day"), plural ("days"), and already-plural forms.
 * - Returns the original string if it is not a recognized DateTimeDurationUnit.
 * - Returns a non-string input unchanged, so callers can pass raw option values and let their own
 *   validator reject them.
 *
 * @param unit raw unit value from caller input
 * @returns normalized plural unit string, or the original if not recognized
 */
export function resolveDurationUnit(unit: string): string;
export function resolveDurationUnit(unit: unknown): unknown;
export function resolveDurationUnit(unit: unknown): unknown {
  if (typeof unit !== "string" || isValidDateTimeDurationUnit(unit)) {
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
