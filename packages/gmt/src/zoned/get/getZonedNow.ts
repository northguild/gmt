import { Temporal } from "@js-temporal/polyfill";
import { isValidTimezone } from "../validate";

/**
 * Return the current zoned datetime for the specified IANA timezone.
 *
 * - Uses `Temporal.Now.zonedDateTimeISO(ianaTimezone)`.
 * - Returns empty string "" for invalid timezone or on failure.
 *
 * @param ianaTimezone IANA timezone identifier
 * @returns zoned ISO 8601 datetime string or empty string when invalid
 */
export function getZonedNow(ianaTimezone: string): string {
  if (!isValidTimezone(ianaTimezone)) {
    return "";
  }

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
    return now.toString();
  } catch {
    return "";
  }
}
