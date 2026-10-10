import type { Temporal } from "@js-temporal/polyfill";
import { resolveWeekStartsOn } from "./resolveWeekStartsOn";
import {
  resolveUnixEpochUnit,
  toUnixEpoch,
  unixEpochToInstant,
} from "./unixEpochValue";
import { zonedUnitEnd, zonedUnitStart } from "./zonedBucket";
import { frameInstant, frameZoned, normalizeZoneFrame } from "./zoneFrame";

/**
 * Internal shared implementation for `startOfUnix` / `endOfUnix` and the quarter functions.
 *
 * - Converts the epoch to a ZonedDateTime, snaps to the start or end of the
 *   requested unit, then converts back to an epoch number.
 * - `unit` is already resolved to a singular Temporal `DateUnit` / `TimeUnit` by the public caller,
 *   or `"quarter"` from `startOfQuarterForUnix` / `endOfQuarterForUnix` only.
 * - `value` follows the one epoch grammar (`parseUnixEpochValue`); `epochUnit` accepts singular
 *   and plural names and defaults to `"milliseconds"`.
 * - `timeZone` defaults to `"UTC"`; `"local"` is the system zone; a time zone identifier or a
 *   stored UTC offset (`±HH:MM[:SS]`) is read as written; anything else returns null.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null.
 * - The boundary is always the real local bucket from `internal/zonedBucket.ts` — a start never
 *   after `value`, an end never before it.
 *
 * @param value Unix epoch number or digit string
 * @param unit resolved unit to snap to
 * @param options optional: epochUnit, timeZone, weekStartsOn
 * @param isEnd false for start-of-unit, true for end-of-unit
 * @returns Unix epoch number, or null on invalid input
 */
export function startOrEndOfUnix(
  value: unknown,
  unit: Temporal.DateTimeUnit | "quarter",
  options: {
    epochUnit?: unknown;
    timeZone?: string;
    weekStartsOn?: unknown;
  },
  isEnd: boolean,
): number | null {
  const epochUnit = resolveUnixEpochUnit(options.epochUnit);
  const frame = normalizeZoneFrame(options.timeZone);
  const weekStartsOn = resolveWeekStartsOn(options.weekStartsOn);

  if (frame === null || epochUnit === null || weekStartsOn === null) {
    return null;
  }

  const instant = unixEpochToInstant(value, epochUnit);

  if (instant === null) {
    return null;
  }

  const weekStartDay = weekStartsOn === "monday" ? 1 : 7;

  try {
    const source = frameZoned(instant, frame);

    const boundary = isEnd
      ? zonedUnitEnd(source, unit, weekStartDay)
      : zonedUnitStart(source, unit, weekStartDay);

    return boundary
      ? toUnixEpoch(frameInstant(boundary, frame), epochUnit)
      : null;
  } catch {
    return null;
  }
}
