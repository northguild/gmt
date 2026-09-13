import { Temporal } from "@js-temporal/polyfill";
import { zonedUnitEnd } from "../../internal";
import { isValidDateTimeUnit } from "../../plain";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the end of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - With neither `disambiguation` nor `offset` passed, returns the last instant of the real local `unit` containing `value` in its own zone — one nanosecond before the next bucket `floorToZone` would return — so the result is never before `value`. The second pass of New York's repeated fall-back hour ends at 01:59:59.999999999 −05:00, and `Australia/Lord_Howe`'s 90-minute fall-back hour ends in its new offset.
 * - A transition that reopens the previous local date makes that stretch its own bucket: `America/Goose_Bay`'s 00:01 fall-back on 7 November 2010 re-entered 6 November for 59 minutes, so the day holding `2010-11-06T23:30:00-04:00` ends at 23:59:59.999999999 −04:00.
 * - Passing `disambiguation` or `offset` opts into Temporal's wall-clock `.with()` resolution of the reset fields instead, unchanged from earlier releases. That result can land before `value` on the other pass of an overlap.
 * - `disambiguation` (opt-in path) controls DST gap/overlap resolution when the boundary jump lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in "").
 * - `offset` (opt-in path) controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** for almost every case here since the source offset is nearly always still valid after a same-day field reset), "use", "ignore" (**the default once either option is passed** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`).
 * - `weekStartsOn` and `fractionalSecondDigits` apply on both paths and never opt into wall-clock resolution.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the end
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore" once either is passed)
 * @returns zoned ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-29T23:59:59+00:00[UTC]"
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month", { fractionalSecondDigits: 9 }) // "2024-02-29T23:59:59.999999999+00:00[UTC]"
 * @example endOfZoned("invalid", "month") // ""
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour") // "2024-11-03T01:59:59-05:00[America/New_York]" (the second, repeated 1am is its own hour)
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour", { disambiguation: "earlier" }) // "2024-11-03T01:59:59-04:00[America/New_York]" (opting in: the wall-clock 1:59:59 resolved to the first (EDT) pass, before the source)
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour", { disambiguation: "reject" }) // "" (opting in: "reject" throws because the wall-clock 1:59:59 is ambiguous between the two passes)
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
  const resolvesWallClock =
    optionsArg?.disambiguation !== undefined ||
    optionsArg?.offset !== undefined;

  if (!isValidZonedDateTime(value) || !isValidDateTimeUnit(unit)) return "";

  // Handle default precision: 0 for > sec, 3 for ms, 6 for µs, 9 for ns
  const precisionMap: Record<string, FractionalDigit> = {
    millisecond: 3,
    microsecond: 6,
    nanosecond: 9,
  };
  const fractionalDigits = fractionalSecondDigits ?? (precisionMap[unit] || 0);

  try {
    const source = Temporal.ZonedDateTime.from(value);

    if (!resolvesWallClock) {
      const end = zonedUnitEnd(source, unit, weekStartsOn === "monday" ? 1 : 7);

      return end
        ? end.toString({ fractionalSecondDigits: fractionalDigits })
        : "";
    }

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

    return result.toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
