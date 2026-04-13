import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Return the start of the quarter for a given zoned ISO datetime.
 *
 * - Validates input using isValidZonedDateTime.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO ZonedDateTime string
 * @returns ISO ZonedDateTime string for the start of the quarter, or empty string on invalid input
 */
export function startOfQuarterForZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zdt = Temporal.ZonedDateTime.from(value);
    const month = zdt.month;
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    return zdt
      .with({ month: quarterStartMonth, day: 1, hour: 0, minute: 0, second: 0 })
      .toString();
  } catch {
    return "";
  }
}
