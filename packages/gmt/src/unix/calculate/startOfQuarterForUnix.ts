import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the start of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter start, converts back to epoch.
 * - Q1 returns month 1, Q2 returns month 4, Q3 returns month 7, Q4 returns month 10.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Unix epoch number representing the start of the quarter, or null on invalid input
 *
 * @example startOfQuarterForUnix(1706659200000) // 1704067200000
 * @example startOfQuarterForUnix(-86400000) // -25598400001 (Q1 1969 starts Jan 1)
 */
export function startOfQuarterForUnix(
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
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    const result = zdt.with({
      month: quarterStartMonth,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
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
