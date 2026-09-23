import { Temporal } from "@js-temporal/polyfill";
import { resolveUnixEpochUnit, unixEpochToInstant } from "./unixEpochValue";

/**
 * Compare two unix epoch values as instants, for the unix comparison predicates.
 *
 * @param value1 first epoch value (number or digit string)
 * @param value2 second epoch value
 * @param options optional `{ epochUnit }` (milliseconds by default; singular names accepted)
 * @returns `Temporal.Instant.compare`'s -1, 0 or 1, or null when the unit or either value is invalid
 * @example compareUnixEpochs(0, "1000") // -1
 * @example compareUnixEpochs("1706659200", 1706659200, { epochUnit: "second" }) // 0
 * @example compareUnixEpochs(0, 1.5) // null (not an integer epoch)
 */
export function compareUnixEpochs(
  value1: unknown,
  value2: unknown,
  options?: { epochUnit?: unknown },
): number | null {
  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);

  if (epochUnit === null) {
    return null;
  }

  const instant1 = unixEpochToInstant(value1, epochUnit);
  const instant2 = unixEpochToInstant(value2, epochUnit);

  if (instant1 === null || instant2 === null) {
    return null;
  }

  return Temporal.Instant.compare(instant1, instant2);
}
