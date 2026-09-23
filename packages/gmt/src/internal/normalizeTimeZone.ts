import { getSystemTimeZone } from "../zoned/get/getSystemTimeZone";
import { isValidTimeZone } from "../zoned/validate";

/**
 * Resolve the `timeZone` option of every `unix/` function and the `utc/` formatters.
 *
 * - Omitted (`undefined`) → `"UTC"`. A Unix epoch and a UTC string name an instant, so no host
 *   zone is read unless asked for.
 * - `"local"` → the system time zone (`getSystemTimeZone()`), or `""` when the host reports none
 *   that is valid.
 * - A valid IANA identifier → returned as-is.
 * - Anything else (`null`, `""`, a typo, a non-string) → `""`, the caller's cue to return its
 *   sentinel. ECMA-402 `Intl.DateTimeFormat` and Temporal `ToTemporalTimeZoneIdentifier` throw
 *   `RangeError` for an unknown zone, so a typo never silently renders UTC.
 *
 * @param timeZone the caller's `timeZone` option
 * @returns the zone to use, or `""` when invalid
 *
 * @example normalizeTimeZone(undefined) // "UTC"
 * @example normalizeTimeZone("local") // system zone, e.g. "America/New_York"
 * @example normalizeTimeZone("Europe/Helsinki") // "Europe/Helsinki"
 * @example normalizeTimeZone("America/New_Yrok") // ""
 */
export function normalizeTimeZone(timeZone?: unknown): string {
  if (timeZone === undefined) return "UTC";

  const resolved = timeZone === "local" ? getSystemTimeZone() : timeZone;

  return typeof resolved === "string" &&
    resolved.length > 0 &&
    isValidTimeZone(resolved)
    ? resolved
    : "";
}
