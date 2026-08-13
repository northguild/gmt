import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";
import { resolveDurationUnit } from "../../internal";

/**
 * Split a Unix epoch interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (non-finite/non-integer start/end, unsupported unit,
 *   non-positive amount, or invalid timeZone).
 *
 * Uses the system timeZone for calendar-unit arithmetic (consistent with `addUnix`).
 *
 * @param start Unix epoch value (seconds or milliseconds) — interval start
 * @param end Unix epoch value (seconds or milliseconds) — interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 6) // [{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]
 * @example splitIntervalByUnitUnix(0, 3600000, "hour", 1) // [{ start: 0, end: 3600000 }]
 * @example splitIntervalByUnitUnix(0, 0, "hour", 1) // [{ start: 0, end: 0 }]
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 0) // []
 * @example splitIntervalByUnitUnix("invalid", 86400000, "hour", 1) // []
 */
export function splitIntervalByUnitUnix(
  start: number | string,
  end: number | string,
  unit: string,
  amount: number,
): Array<{ start: number; end: number }> {
  if (typeof start !== "number" && typeof start !== "string") {
    return [];
  }

  if (typeof end !== "number" && typeof end !== "string") {
    return [];
  }

  const startMs = typeof start === "number" ? start : Number(start);
  const endMs = typeof end === "number" ? end : Number(end);

  if (!Number.isFinite(startMs) || !Number.isInteger(startMs)) {
    return [];
  }

  if (!Number.isFinite(endMs) || !Number.isInteger(endMs)) {
    return [];
  }

  if (startMs > endMs) {
    return [];
  }

  if (typeof unit !== "string") {
    return [];
  }

  const resolvedUnit = resolveDurationUnit(unit);

  if (!resolvedUnit) {
    return [];
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  try {
    const timeZone = getSystemTimeZone();
    if (!timeZone || !isValidTimeZone(timeZone)) {
      return [];
    }

    if (startMs === endMs) {
      return [{ start: startMs, end: endMs }];
    }

    const result: Array<{ start: number; end: number }> = [];

    for (let currentMs = startMs; currentMs < endMs;) {
      const instant = Temporal.Instant.fromEpochMilliseconds(currentMs);
      const zoned = instant.toZonedDateTimeISO(timeZone);
      const next = zoned.add({ [resolvedUnit]: amount }).toInstant();
      const nextMs = next.epochMilliseconds;

      if (nextMs === currentMs) {
        return [];
      }

      const sliceEndMs = nextMs > endMs ? endMs : nextMs;

      result.push({
        start: currentMs,
        end: sliceEndMs,
      });

      currentMs = nextMs;
    }

    return result;
  } catch {
    return [];
  }
}
