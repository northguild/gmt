import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import type { Disambiguation, Offset } from "../../types";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the start of the specified unit for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, sets to start of unit, converts back to epoch.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - `disambiguation` controls DST gap/overlap resolution when the boundary jump lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in null).
 * - `offset` controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** for almost every case here since the source offset is nearly always still valid after a same-day field reset), "use", "ignore" (**this function's default** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`). Leave `offset` at its default unless you specifically need Temporal's raw `.with()` semantics.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the start
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday"), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns Unix epoch number representing the start of the unit, or null on invalid input
 *
 * @example startOfUnix(1706659200000, "year") // 1704067200000
 * @example startOfUnix(1706659200000, "month") // 1705353600000
 * @example startOfUnix(1706659200, "day", { epochUnit: "seconds" }) // 1706640000
 * @example startOfUnix(-86400000, "year") // -31536000001 (start of 1969)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject" }) // null (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back overlap; start-of-hour is ambiguous)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject", offset: "prefer" }) // 1730613600000 (setting offset to "prefer" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and "reject" never fires)
 */
export function startOfUnix(
  value: number,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): number | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();
  const weekStartsOn = options?.weekStartsOn ?? "monday";
  const disambiguation = options?.disambiguation ?? "compatible";
  const offset = options?.offset ?? "ignore";

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
        result = source.with(
          {
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
            microsecond: 0,
            nanosecond: 0,
          },
          { disambiguation, offset },
        );
        break;
      case "month":
        result = source.with(
          {
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
            microsecond: 0,
            nanosecond: 0,
          },
          { disambiguation, offset },
        );
        break;
      case "week": {
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        const startOfWeekDate = source.subtract({ days: daysToSubtract });
        result = startOfWeekDate.with(
          {
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
            microsecond: 0,
            nanosecond: 0,
          },
          { disambiguation, offset },
        );
        break;
      }
      case "day":
        result = source.with(
          {
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
            microsecond: 0,
            nanosecond: 0,
          },
          { disambiguation, offset },
        );
        break;
      case "hour":
        result = source.with(
          {
            minute: 0,
            second: 0,
            millisecond: 0,
            microsecond: 0,
            nanosecond: 0,
          },
          { disambiguation, offset },
        );
        break;
      case "minute":
        result = source.with(
          { second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 },
          { disambiguation, offset },
        );
        break;
      case "second":
        result = source.with(
          { millisecond: 0, microsecond: 0, nanosecond: 0 },
          { disambiguation, offset },
        );
        break;
      case "millisecond":
        result = source.with(
          { microsecond: 0, nanosecond: 0 },
          { disambiguation, offset },
        );
        break;
      case "microsecond":
        result = source.with({ nanosecond: 0 }, { disambiguation, offset });
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
