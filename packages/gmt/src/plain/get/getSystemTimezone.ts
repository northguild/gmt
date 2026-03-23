/**
 * Return the runtime system timezone name (for example "America/New_York").
 *
 * - Uses Intl.DateTimeFormat().resolvedOptions().timeZone to discover
 *   the host timezone.
 * - Returns an empty string if the timezone cannot be determined.
 *
 * @returns system timezone name or an empty string on failure
 */
export function getSystemTimezone(): string {
  try {
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return systemTimeZone || "";
  } catch {
    return "";
  }
}
