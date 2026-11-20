import { isRefusedZoneName } from "../../internal/refusedZoneNames";

/**
 * Return the array of all available IANA timezone identifiers.
 *
 * - Uses `Intl.supportedValuesOf('timeZone')` to get the full list.
 * - Leaves out the nine names GMT refuses on every host (`EST5EDT`, `CST6CDT`, `MST7MDT`,
 *   `PST8PDT`, `CET`, `EET`, `MET`, `WET`, `Factory`), so every name listed is valid.
 * - Returns `[]` when the API is unavailable (older runtimes).
 *
 * @returns array of IANA timezone identifier strings, or `[]` on failure
 *
 * @example getTimeZones() // ["Africa/Abidjan", "Africa/Accra", ...]
 * @example getTimeZones().length // ~422 (varies by runtime/ICU)
 */
export function getTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone").filter(
      (timeZone) => !isRefusedZoneName(timeZone),
    );
  } catch {
    return [];
  }
}
