import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the start of the quarter for a given UTC datetime string.
 *
 * - Calculates quarter start month: Q1=1, Q2=4, Q3=7, Q4=10.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g. "2024-03-15T12:00:00Z")
 * @returns ISO UTC datetime string representing the start of the quarter, or "" on invalid input
 *
 * @example startOfQuarterForUtc("2024-03-15T12:00:00Z") // "2024-01-01T00:00:00Z"
 * @example startOfQuarterForUtc("invalid") // ""
 */
export function startOfQuarterForUtc(value: string): string {
  if (!isValidUtc(value)) {
    return "";
  }

  try {
    const instant = Temporal.Instant.from(value);
    const zdt = instant.toZonedDateTimeISO("UTC");
    const month = zdt.month;
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    const result = zdt
      .with({ month: quarterStartMonth, day: 1, hour: 0, minute: 0, second: 0 })
      .toInstant();

    return result.toString();
  } catch {
    return "";
  }
}
