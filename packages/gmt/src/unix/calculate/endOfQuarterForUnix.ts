import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the end of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter end, converts back to epoch.
 * - Q1 ends month 3, Q2 ends month 6, Q3 ends month 9, Q4 ends month 12.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Unix epoch number representing the end of the quarter, or null on invalid input
 *
 * @example endOfQuarterForUnix(1706659200000) // 1711977599999
 * @example endOfQuarterForUnix(-86400000) // -1 (Q4 1969 ends Dec 31)
 */
export function endOfQuarterForUnix(
  value: number,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  },
): number | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();

  if (!timeZone || !isValidTimeZone(timeZone) || !isValidUnixUnit(epochUnit)) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value * 1000 : value,
    );

    const zdt = instant.toZonedDateTimeISO(timeZone);
    const month = zdt.month;
    const quarterEndMonth = Math.floor((month - 1) / 3) * 3 + 3;

    const quarterStart = zdt.with({
      month: quarterEndMonth,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    });
    const nextQuarterStart = quarterStart.add({ months: 1 });
    const lastDayOfQuarter = nextQuarterStart.subtract({ days: 1 });

    const result = lastDayOfQuarter.with({
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
      microsecond: 999,
      nanosecond: 999,
    });

    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;

    return epoch;
  } catch {
    return null;
  }
}
