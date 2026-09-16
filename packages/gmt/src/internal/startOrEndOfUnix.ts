import { Temporal } from "@js-temporal/polyfill";
import { zonedUnitEnd, zonedUnitStart } from "./zonedBucket";
import { isValidDateTimeUnit } from "../plain";
import type { Disambiguation, Offset } from "../types";
import { isValidUnixUnit } from "../unix/validate/isValidUnixUnit";
import { getSystemTimeZone } from "../zoned/get";
import { isValidTimeZone } from "../zoned/validate";

/**
 * Internal shared implementation for `startOfUnix` / `endOfUnix`.
 *
 * - Converts the epoch to a ZonedDateTime, snaps to the start or end of the
 *   requested unit, then converts back to an epoch number.
 * - Supports every Temporal `DateUnit` and `TimeUnit`, plus the internal `"quarter"` walker unit
 *   used by `startOfQuarterForUnix` / `endOfQuarterForUnix`.
 * - `epochUnit` controls whether the input/output is interpreted as `"milliseconds"` (default) or `"seconds"`.
 * - `timeZone` defaults to the system time zone via `getSystemTimeZone()`.
 * - The boundary is always the real local bucket from `internal/zonedBucket.ts` — a start never
 *   after `value`, an end never before it. `disambiguation` and `offset` are accepted for
 *   compatibility and ignored.
 *
 * @param value Unix epoch number
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to snap to
 * @param options optional: epochUnit, timeZone, weekStartsOn, disambiguation and offset (ignored)
 * @param isEnd false for start-of-unit, true for end-of-unit
 * @returns Unix epoch number, or null on invalid input
 */
export function startOrEndOfUnix(
  value: number,
  unit: Temporal.DateUnit | Temporal.TimeUnit | "quarter",
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
  const weekStartDay = (options.weekStartsOn ?? "monday") === "monday" ? 1 : 7;

  if (
    !timeZone ||
    (unit !== "quarter" && !isValidDateTimeUnit(unit)) ||
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
    const source =
      Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(
        timeZone,
      );

    const boundary = isEnd
      ? zonedUnitEnd(source, unit, weekStartDay)
      : zonedUnitStart(source, unit, weekStartDay);

    if (!boundary) return null;

    return epochUnit === "seconds"
      ? Math.floor(boundary.epochMilliseconds / 1000)
      : boundary.epochMilliseconds;
  } catch {
    return null;
  }
}
