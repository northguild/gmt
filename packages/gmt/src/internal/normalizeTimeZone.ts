import { getSystemTimeZone } from "../plain/get/getSystemTimeZone";
import { isValidTimeZone } from "../zoned/validate";

/**
 * Resolve a timezone string for the Unix/UTC formatters.
 *
 * - `"local"` → the system timezone via `getSystemTimeZone()`.
 * - A valid IANA timezone identifier → returned as-is.
 * - Anything else (undefined, empty, invalid name, typo) → `"UTC"`.
 *
 * The UTC fallback is intentional: `formatUnix` / `formatUtc` / the relative
 * formatters expose `timeZone` as an *optional* convenience, so we degrade
 * gracefully when callers pass nothing or pass a typo. Callers that need
 * strict timezone validation should use `isValidTimeZone()` themselves
 * before calling these formatters.
 */
export function normalizeTimeZone(tz?: string): string {
  if (tz === "local") return getSystemTimeZone();
  if (typeof tz === "string" && tz.length > 0 && isValidTimeZone(tz)) return tz;
  return "UTC";
}
