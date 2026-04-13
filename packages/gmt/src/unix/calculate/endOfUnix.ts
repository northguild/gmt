import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { isValidTimeZone } from "../../zoned/validate";

const supported: (Temporal.DateUnit | Temporal.TimeUnit)[] = [
  "year",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

/**
 * Return the end of the specified unit for a Unix timestamp.
 *
 * - Accepts Unix timestamps in milliseconds (default) or seconds.
 * - Returns null for invalid inputs.
 *
 * @param value Unix timestamp (number)
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the end
 * @param options epochUnit optional "seconds" | "milliseconds", timeZone optional IANA timeZone, weekStartsOn optional "monday" | "sunday"
 * @example endOfUnix(1706659200000, "year") // 1735689600000
 * @example endOfUnix(1706659200000, "month") // 1708012800000
 * @example endOfUnix(1706659200, "day", { epochUnit: "seconds" }) // 1706736000
 * @returns Unix epoch number representing the end of the unit, or null on invalid input
 */
export function endOfUnix(
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
    !supported.includes(unit) ||
    !isValidTimeZone(timeZone) ||
    !isValidUnixUnit(epochUnit)
  ) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return null;
  }

  try {
    const epochMs = epochUnit === "seconds" ? value * 1000 : value;
    const instant = Temporal.Instant.fromEpochMilliseconds(epochMs);

    const source = instant.toZonedDateTimeISO(timeZone);
    let result: Temporal.ZonedDateTime;

    switch (unit) {
      case "year":
        result = source.with({ month: 12, day: 31 }).withPlainTime({
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
        break;
      case "month": {
        const lastDay = Temporal.PlainDate.from({
          year: source.year,
          month: source.month,
          day: 1,
        }).daysInMonth;
        result = source.with({ day: lastDay }).withPlainTime({
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
        break;
      }
      case "week": {
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        const endOfWeek = source
          .subtract({ days: daysToSubtract })
          .add({ days: 6 });
        result = endOfWeek.withPlainTime({
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
        break;
      }
      case "day":
        result = source.withPlainTime({
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
        break;
      case "hour":
        result = source.with({
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
        break;
      case "minute":
        result = source.with({
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
        break;
      case "second":
        result = source.with({
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
        break;
      case "millisecond":
        result = source.with({ microsecond: 999, nanosecond: 999 });
        break;
      case "microsecond":
        result = source.with({ nanosecond: 999 });
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
