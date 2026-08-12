import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the end of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Converts to ZonedDateTime, sets to end of unit, converts back to string.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - `disambiguation` controls DST gap/overlap resolution when the boundary jump lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in "").
 * - `offset` controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** for almost every case here since the source offset is nearly always still valid after a same-day field reset), "use", "ignore" (**this function's default** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`). Leave `offset` at its default unless you specifically need Temporal's raw `.with()` semantics.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the end
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns zoned ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-29T23:59:59.999999999+00:00[UTC]"
 * @example endOfZoned("invalid", "month") // ""
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour", { disambiguation: "earlier" }) // "2024-11-03T01:59:59-04:00[America/New_York]" (source sits in the second, repeated 1am of the fall-back overlap; "earlier" resolves end-of-hour to the first (EDT) pass)
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour", { disambiguation: "reject" }) // "" (same overlap; "reject" throws because end-of-hour is ambiguous between the two 1am instants)
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour", { disambiguation: "reject", offset: "prefer" }) // "2024-11-03T01:59:59-05:00[America/New_York]" (setting offset to "prefer" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and "reject" never fires)
 */
export function endOfZoned(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
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
            month: 12,
            day: 31,
            hour: 23,
            minute: 59,
            second: 59,
            millisecond: 999,
            microsecond: 999,
            nanosecond: 999,
          },
          { disambiguation, offset },
        );
        break;
      case "month": {
        const lastDay = Temporal.PlainDate.from({
          year: source.year,
          month: source.month,
          day: 1,
        }).daysInMonth;
        result = source.with(
          {
            day: lastDay,
            hour: 23,
            minute: 59,
            second: 59,
            millisecond: 999,
            microsecond: 999,
            nanosecond: 999,
          },
          { disambiguation, offset },
        );
        break;
      }
      case "week": {
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        const endOfWeekDate = source
          .subtract({ days: daysToSubtract })
          .add({ days: 6 });
        result = endOfWeekDate.with(
          {
            hour: 23,
            minute: 59,
            second: 59,
            millisecond: 999,
            microsecond: 999,
            nanosecond: 999,
          },
          { disambiguation, offset },
        );
        break;
      }
      case "day":
        result = source.with(
          {
            hour: 23,
            minute: 59,
            second: 59,
            millisecond: 999,
            microsecond: 999,
            nanosecond: 999,
          },
          { disambiguation, offset },
        );
        break;
      case "hour":
        result = source.with(
          {
            minute: 59,
            second: 59,
            millisecond: 999,
            microsecond: 999,
            nanosecond: 999,
          },
          { disambiguation, offset },
        );
        break;
      case "minute":
        result = source.with(
          { second: 59, millisecond: 999, microsecond: 999, nanosecond: 999 },
          { disambiguation, offset },
        );
        break;
      case "second":
        result = source.with(
          { millisecond: 999, microsecond: 999, nanosecond: 999 },
          { disambiguation, offset },
        );
        break;
      case "millisecond":
        result = source.with(
          { microsecond: 999, nanosecond: 999 },
          { disambiguation, offset },
        );
        break;
      case "microsecond":
        result = source.with({ nanosecond: 999 }, { disambiguation, offset });
        break;
      case "nanosecond":
        result = source; // Smallest unit, nothing to set
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
