import { isValidTimeZone } from "../validate";

/**
 * Return the runtime system timeZone name (for example "America/New_York").
 *
 * - Uses Intl.DateTimeFormat().resolvedOptions().timeZone to get system timezone.
 * - Returns "" when the host reports no usable time zone. With an empty `TZ` the runtime reports
 *   ICU's placeholder `"Etc/Unknown"`, and with an unrecognised `TZ` it reports `undefined`;
 *   neither is a zone that Temporal or `Intl.DateTimeFormat` accepts.
 *
 * @returns system timeZone name or "" on failure
 *
 * @example getSystemTimeZone() // "America/New_York"
 */
export function getSystemTimeZone(): string {
  try {
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(systemTimeZone) ? systemTimeZone : "";
  } catch {
    return "";
  }
}
