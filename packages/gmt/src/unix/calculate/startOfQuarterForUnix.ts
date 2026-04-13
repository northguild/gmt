import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the start of the quarter for a Unix timestamp.
 *
 * - Accepts Unix timestamps in milliseconds (default) or seconds.
 * - Returns null for invalid inputs.
 *
 * @param value Unix timestamp (number)
 * @param options epochUnit optional "seconds" | "milliseconds", timeZone optional IANA timeZone
 * @example startOfQuarterForUnix(1706659200000) // 1704067200000
 * @example startOfQuarterForUnix(1706659200, { epochUnit: "seconds" }) // 1704067200
 * @returns Unix epoch number representing the start of the quarter, or null on invalid input
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

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
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
