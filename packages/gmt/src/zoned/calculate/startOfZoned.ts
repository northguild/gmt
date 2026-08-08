import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain/validate";
import type {
  DateTimeUnit,
  Disambiguation,
  FractionalDigit,
  Offset,
} from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the start of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Converts to ZonedDateTime, sets to start of unit, converts back to string.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - `disambiguation` controls DST gap/overlap resolution when the boundary jump lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in "").
 * - `offset` controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** for almost every case here since the source offset is nearly always still valid after a same-day field reset), "use", "ignore" (**this function's default** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`). Leave `offset` at its default unless you specifically need Temporal's raw `.with()` semantics.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the start
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns zoned ISO 8601 string representing the start of the specified unit, or "" on invalid input
 *
 * @example startOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-01T00:00:00+00:00[UTC]"
 * @example startOfZoned("invalid", "month") // ""
 * @example startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", { disambiguation: "earlier" }) // "2024-11-03T01:00:00-04:00[America/New_York]" (source sits in the second, repeated 1am of the fall-back overlap; "earlier" resolves start-of-hour to the first (EDT) pass)
 * @example startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", { disambiguation: "reject" }) // "" (same overlap; "reject" throws because start-of-hour is ambiguous between the two 1am instants)
 * @example startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", { disambiguation: "reject", offset: "prefer" }) // "2024-11-03T01:00:00-05:00[America/New_York]" (setting offset to "prefer" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and "reject" never fires)
 */
export function startOfZoned(
  value: string,
  unit: DateTimeUnit,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): string {
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;
  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";

  if (!isValidZonedDateTime(value) || !isValidDateTimeUnit(unit)) return "";

  try {
    const source = Temporal.ZonedDateTime.from(value);
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
          {
            second: 0,
            millisecond: 0,
            microsecond: 0,
            nanosecond: 0,
          },
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
        result = source; // Smallest unit, nothing to reset
        break;
      default:
        return "";
    }

    // Handle default precision: 0 for > sec, 3 for ms, 6 for µs, 9 for ns
    const precisionMap: Record<string, FractionalDigit> = {
      millisecond: 3,
      microsecond: 6,
      nanosecond: 9,
    };
    const fractionalDigits =
      fractionalSecondDigits ?? (precisionMap[unit] || 0);

    return result.toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
