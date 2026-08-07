/**
 * Return the runtime system timeZone name (for example "America/New_York").
 *
 * - Uses Intl.DateTimeFormat().resolvedOptions().timeZone to get system timezone.
 * - Returns "" when timezone is unavailable.
 *
 * @returns system timeZone name or "" on failure
 *
 * @example getSystemTimeZone() // "America/New_York"
 */
export function getSystemTimeZone(): string {
  try {
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return systemTimeZone || "";
  } catch {
    return "";
  }
}
