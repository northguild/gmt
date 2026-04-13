/**
 * Return the runtime system timeZone name (for example "America/New_York").
 *
 * - Uses Intl.DateTimeFormat().resolvedOptions().timeZone to discover
 *   the host timeZone.
 * - Returns an empty string if the timeZone cannot be determined.
 *
 * @example getSystemTimeZone() // "America/New_York"
 * @returns system timeZone name or an empty string on failure
 */
export function getSystemTimeZone(): string {
  try {
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return systemTimeZone || "";
  } catch {
    return "";
  }
}
