import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Return the start of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the first day of that quarter.
 * - Validation is performed on the input.
 *
 * @param value ISO ZonedDateTime string
 * @returns ISO ZonedDateTime string for the start of the quarter, or "" on invalid input
 *
 * @example startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-01-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-04-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-10-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("invalid") // ""
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
