// function that uses Temporal polyfill and validates if the passed string is a valid IANA timezone

import { Temporal } from "@js-temporal/polyfill";
import { timezoneLike } from "../../regex";

/**
 * Validate whether a string is a valid IANA timezone identifier.
 *
 * - Uses the Temporal polyfill to construct a ZonedDateTime and a regex
 *   sanity-check on the timezone string.
 * - Returns `true` when the timezone appears valid, otherwise `false`.
 *
 * @param timeZone timezone identifier to validate
 * @returns boolean indicating validity
 */
export function isValidTimezone(timeZone: string): boolean {
  try {
    Temporal.ZonedDateTime.from({
      year: 2020,
      month: 2,
      day: 28,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone,
    });
    return timezoneLike.test(timeZone) && true;
  } catch {
    return false;
  }
}
