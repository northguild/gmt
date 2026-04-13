import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../../plain/validate";
import { isValidTimeZone } from "../validate";

/**
 * Return the plain date for the specified `value` interpreted in `timeZone`.
 *
 * - `value` is a plain ISO date string (YYYY-MM-DD).
 * - `timeZone` must be a valid IANA timeZone id.
 * - Returns an empty string "" for invalid inputs.
 *
 * @param value ISO date string (YYYY-MM-DD)
 * @param timeZone IANA timeZone identifier
 * @returns plain ISO date string or empty string when invalid
 */
export function getZonedDate(value: string, timeZone: string): string {
  if (!isValidDate(value) || !isValidTimeZone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(`${value}[${timeZone}]`);
    return zonedDateTime.toPlainDate().toString();
  } catch {
    return "";
  }
}
