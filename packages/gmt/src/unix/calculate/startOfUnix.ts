import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import { getSystemTimeZone } from "../../plain/get";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the start of the specified unit for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, sets to start of unit, converts back to epoch.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the start
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday")
 * @returns Unix epoch number representing the start of the unit, or null on invalid input
 *
 * @example startOfUnix(1706659200000, "year") // 1704067200000
 * @example startOfUnix(1706659200000, "month") // 1705353600000
 * @example startOfUnix(1706659200, "day", { epochUnit: "seconds" }) // 1706640000
 * @example startOfUnix(-86400000, "year") // -31536000001 (start of 1969)
 */
export function startOfUnix(
  value: number,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): number | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();
  const weekStartsOn = options?.weekStartsOn ?? "monday";

  if (
    !timeZone ||
    !isValidDateTimeUnit(unit) ||
    !isValidTimeZone(timeZone) ||
    !isValidUnixUnit(epochUnit)
  ) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }

  try {
    const epochMs = epochUnit === "seconds" ? value * 1000 : value;
    const instant = Temporal.Instant.fromEpochMilliseconds(epochMs);

    const source = instant.toZonedDateTimeISO(timeZone);
    let result: Temporal.ZonedDateTime;

    switch (unit) {
      case "year":
        result = source.with({ month: 1, day: 1 }).withPlainTime();
        break;
      case "month":
        result = source.with({ day: 1 }).withPlainTime();
        break;
      case "week": {
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        result = source.subtract({ days: daysToSubtract }).withPlainTime();
        break;
      }
      case "day":
        result = source.withPlainTime();
        break;
      case "hour":
        result = source.with({
          minute: 0,
          second: 0,
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
        });
        break;
      case "minute":
        result = source.with({
          second: 0,
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
        });
        break;
      case "second":
        result = source.with({
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
        });
        break;
      case "millisecond":
        result = source.with({ microsecond: 0, nanosecond: 0 });
        break;
      case "microsecond":
        result = source.with({ nanosecond: 0 });
        break;
      case "nanosecond":
        result = source;
        break;
      default:
        return null;
    }

    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;

    return epoch;
  } catch {
    return null;
  }
}
