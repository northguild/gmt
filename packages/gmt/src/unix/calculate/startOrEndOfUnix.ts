import { Temporal } from "@js-temporal/polyfill";
import { zonedUnitEnd, zonedUnitStart } from "../../internal";
import { isValidDateTimeUnit } from "../../plain";
import type { Disambiguation, Offset } from "../../types";
import { isValidUnixUnit } from "../../unix/validate/isValidUnixUnit";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Internal shared implementation for `startOfUnix` / `endOfUnix`.
 *
 * - Converts the epoch to a ZonedDateTime, snaps to the start or end of the
 *   requested unit, then converts back to an epoch number.
 * - Supports every Temporal `DateUnit` and `TimeUnit`.
 * - `epochUnit` controls whether the input/output is interpreted as `"milliseconds"` (default) or `"seconds"`.
 * - `timeZone` defaults to the system time zone via `getSystemTimeZone()`.
 * - With neither `disambiguation` nor `offset` passed, the boundary is the
 *   real local bucket from `internal/zonedBucket.ts` — a start never after
 *   `value`, an end never before it.
 * - Passing either forwards both to Temporal's `.with()` for DST-gap/overlap
 *   boundaries instead; see `startOfUnix`'s JSDoc for the full semantics —
 *   they behave identically here.
 *
 * @param value Unix epoch number
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to snap to
 * @param options optional: epochUnit, timeZone, weekStartsOn, disambiguation, offset
 * @param isEnd false for start-of-unit, true for end-of-unit
 * @returns Unix epoch number, or null on invalid input
 */
export function startOrEndOfUnix(
  value: number,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
  isEnd: boolean,
): number | null {
  const epochUnit = options.epochUnit ?? "milliseconds";
  const timeZone = options.timeZone ?? getSystemTimeZone();
  const weekStartsOn = options.weekStartsOn ?? "monday";
  const disambiguation = options.disambiguation ?? "compatible";
  const offset = options.offset ?? "ignore";

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

    // Neither `disambiguation` nor `offset` passed: the real local bucket, never a re-resolved
    // wall clock, so a start is never after `value` and an end never before it.
    if (options.disambiguation === undefined && options.offset === undefined) {
      const weekStartDay = weekStartsOn === "monday" ? 1 : 7;
      const boundary = isEnd
        ? zonedUnitEnd(source, unit, weekStartDay)
        : zonedUnitStart(source, unit, weekStartDay);

      if (!boundary) return null;

      return epochUnit === "seconds"
        ? Math.floor(boundary.epochMilliseconds / 1000)
        : boundary.epochMilliseconds;
    }

    const timeFields = isEnd
      ? {
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        }
      : {
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
        };
    let result: Temporal.ZonedDateTime;

    switch (unit) {
      case "year":
        result = isEnd
          ? source.with(
              { month: 12, day: 31, ...timeFields },
              { disambiguation, offset },
            )
          : source.with(
              { month: 1, day: 1, ...timeFields },
              { disambiguation, offset },
            );
        break;
      case "month": {
        const lastDay = Temporal.PlainDate.from({
          year: source.year,
          month: source.month,
          day: 1,
        }).daysInMonth;
        result = isEnd
          ? source.with(
              { day: lastDay, ...timeFields },
              { disambiguation, offset },
            )
          : source.with({ day: 1, ...timeFields }, { disambiguation, offset });
        break;
      }
      case "week": {
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        const weekAnchor = source.subtract({ days: daysToSubtract });
        result = isEnd
          ? weekAnchor
              .add({ days: 6 })
              .with({ ...timeFields }, { disambiguation, offset })
          : weekAnchor.with({ ...timeFields }, { disambiguation, offset });
        break;
      }
      case "day":
        result = source.with({ ...timeFields }, { disambiguation, offset });
        break;
      case "hour":
        result = source.with(
          {
            minute: timeFields.minute,
            second: timeFields.second,
            millisecond: timeFields.millisecond,
            microsecond: timeFields.microsecond,
            nanosecond: timeFields.nanosecond,
          },
          { disambiguation, offset },
        );
        break;
      case "minute":
        result = source.with(
          {
            second: timeFields.second,
            millisecond: timeFields.millisecond,
            microsecond: timeFields.microsecond,
            nanosecond: timeFields.nanosecond,
          },
          { disambiguation, offset },
        );
        break;
      case "second":
        result = source.with(
          {
            millisecond: timeFields.millisecond,
            microsecond: timeFields.microsecond,
            nanosecond: timeFields.nanosecond,
          },
          { disambiguation, offset },
        );
        break;
      case "millisecond":
        result = source.with(
          {
            microsecond: timeFields.microsecond,
            nanosecond: timeFields.nanosecond,
          },
          { disambiguation, offset },
        );
        break;
      case "microsecond":
        result = source.with(
          { nanosecond: timeFields.nanosecond },
          { disambiguation, offset },
        );
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
