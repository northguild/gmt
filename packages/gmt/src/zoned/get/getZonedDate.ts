import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../../plain/validate";
import { isValidTimezone } from "../validate";

/**
 * Return the plain date for the specified `value` interpreted in `timeZone`.
 *
 * - `value` is a plain ISO date string (YYYY-MM-DD).
 * - `timeZone` must be a valid IANA timezone id.
 * - Returns an empty string "" for invalid inputs.
 *
 * @param value ISO date string (YYYY-MM-DD)
 * @param timeZone IANA timezone identifier
 * @returns plain ISO date string or empty string when invalid
 */
export function getZonedDate(value: string, timeZone: string): string {
  if (!isValidDate(value) || !isValidTimezone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(`${value}[${timeZone}]`);
    return zonedDateTime.toPlainDate().toString();
  } catch {
    return "";
  }
}
