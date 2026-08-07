/**
 * Return the array of all available IANA timezone identifiers.
 *
 * - Uses `Intl.supportedValuesOf('timeZone')` to get the full list.
 * - Returns `[]` when the API is unavailable (older runtimes).
 *
 * @returns array of IANA timezone identifier strings, or `[]` on failure
 *
 * @example getTimeZones() // ["America/New_York", "Europe/London", ...]
 * @example getTimeZones().length // ~422 (varies by runtime/ICU)
 */
export function getTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone") || [];
  } catch {
    return [];
  }
}
