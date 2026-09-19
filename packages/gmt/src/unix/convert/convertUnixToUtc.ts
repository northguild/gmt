import {
  resolveUnixEpochUnitOptions,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Convert a unix epoch value to a UTC Instant ISO string.
 *
 * - Converts to UTC Instant using Temporal.Instant.
 * - `value` is a safe integer or a string of optionally negative ASCII digits; anything else, or an
 *   instant outside the Temporal range, returns "".
 * - `options.epochUnit` is `"seconds"` or `"milliseconds"` (singular accepted), default
 *   `"milliseconds"`. An explicit `undefined` is the same as omitted; a non-object `options` (such
 *   as a bare `"seconds"` string) returns "".
 *
 * @param value epoch value: a safe integer or a digit string
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds")
 * @returns UTC Instant string or "" on invalid
 *
 * @example convertUnixToUtc(1709164800000) // "2024-02-29T00:00:00Z"
 * @example convertUnixToUtc(1709164800, { epochUnit: "seconds" }) // "2024-02-29T00:00:00Z"
 * @example convertUnixToUtc("1709164800", { epochUnit: "second" }) // "2024-02-29T00:00:00Z"
 * @example convertUnixToUtc(-1) // "1969-12-31T23:59:59.999Z"
 * @example convertUnixToUtc(1709164800, "seconds" as never) // "" (options must be an object)
 * @example convertUnixToUtc(NaN) // ""
 */
export function convertUnixToUtc(
  value: number | string,
  options?: { epochUnit?: UnixUnit },
): string {
  const epochUnit = resolveUnixEpochUnitOptions(options);

  if (epochUnit === null) {
    return "";
  }

  return unixEpochToInstant(value, epochUnit)?.toString() ?? "";
}
