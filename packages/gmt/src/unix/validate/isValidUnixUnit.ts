import { resolveUnixEpochUnit } from "../../internal/unixEpochValue";

/**
 * Unit accepted by `epochUnit` in unix-epoch functions. Determines whether a
 * numeric value is interpreted as milliseconds or seconds.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `seconds` / `second` | Value is Unix epoch seconds (e.g. `1700000000`). |
 * | `milliseconds` / `millisecond` | Value is Unix epoch milliseconds (e.g. `1700000000000`). |
 *
 * Singular and plural names are the same unit, as in Temporal's unit-valued options.
 *
 * @example
 * import { isValidUnixUnit } from "@northguild/gmt/unix";
 * isValidUnixUnit("milliseconds"); // true
 */
export type UnixUnit = "seconds" | "second" | "milliseconds" | "millisecond";

/**
 * Return true when `unit` is a valid UnixUnit.
 *
 * - Valid units are `"seconds"`, `"milliseconds"` and their singular forms `"second"`,
 *   `"millisecond"` (Temporal §13.17 GetTemporalUnitValuedOption accepts both).
 * - Names are case-sensitive; any non-string input returns false.
 *
 * @param unit candidate value of any type
 * @returns boolean indicating whether the unit is a valid UnixUnit
 *
 * @example isValidUnixUnit("seconds") // true
 * @example isValidUnixUnit("millisecond") // true
 * @example isValidUnixUnit("invalid") // false
 * @example isValidUnixUnit(123) // false
 * @example isValidUnixUnit(null) // false
 */
export function isValidUnixUnit(unit: unknown): unit is UnixUnit {
  return unit !== undefined && resolveUnixEpochUnit(unit) !== null;
}
