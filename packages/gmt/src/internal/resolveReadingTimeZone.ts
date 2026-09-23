import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";

/**
 * Resolve the `timeZone` option a UTC reader uses to read a value's wall-clock fields.
 *
 * - `undefined` (the option omitted) resolves to `"UTC"`.
 * - A valid IANA zone (or `"UTC"`) resolves to itself.
 * - Any other value is invalid and resolves to `null`, which callers map to their sentinel.
 *
 * @param timeZone raw option value from caller input
 * @returns the zone to read in, or `null` when the value is invalid
 */
export function resolveReadingTimeZone(timeZone: unknown): string | null {
  if (timeZone === undefined || timeZone === "UTC") return "UTC";

  return typeof timeZone === "string" && isValidTimeZone(timeZone)
    ? timeZone
    : null;
}
