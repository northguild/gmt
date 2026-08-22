import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

const NANOSECONDS_PER_MINUTE = 60_000_000_000;

/**
 * Unit a zoned value's UTC offset can be read as via `getZonedOffsetAs`.
 */
export type ZonedOffsetUnit = "minutes" | "nanoseconds";

function isValidZonedOffsetUnit(unit: unknown): unit is ZonedOffsetUnit {
  return unit === "minutes" || unit === "nanoseconds";
}

/**
 * Read a zoned value's UTC offset as a number, in the given unit.
 *
 * - Subsumes what would otherwise be `getZonedOffsetMinutes` /
 *   `getZonedOffsetNanoseconds` — one differently-scaled reading of the same
 *   underlying quantity through a single parameterized call, following J8's
 *   `getDurationUnit(value, unit)` precedent (Decision 5).
 * - "nanoseconds" reads Temporal's `offsetNanoseconds` directly.
 * - "minutes" divides by 60e9 — every IANA offset is a whole number of
 *   minutes, so this never truncates a fraction.
 * - Negative offsets (west of UTC) return a negative number.
 * - Returns null on invalid `value` or `unit`.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit "minutes" | "nanoseconds"
 * @returns the offset in the requested unit, or null on invalid input
 *
 * @example getZonedOffsetAs("2024-07-15T12:00:00-04:00[America/New_York]", "minutes") // -240
 * @example getZonedOffsetAs("2024-05-15T12:00:00+05:45[Asia/Kathmandu]", "minutes") // 345
 * @example getZonedOffsetAs("2024-02-29T12:00:00+00:00[UTC]", "nanoseconds") // 0
 * @example getZonedOffsetAs("2024-07-15T12:00:00-04:00[America/New_York]", "nanoseconds") // -14400000000000
 * @example getZonedOffsetAs("invalid", "minutes") // null
 * @example getZonedOffsetAs("2024-02-29T12:00:00+00:00[UTC]", "fortnights" as never) // null
 */
export function getZonedOffsetAs(
  value: string,
  unit: ZonedOffsetUnit,
): number | null {
  if (!isValidZonedDateTime(value) || !isValidZonedOffsetUnit(unit)) {
    return null;
  }

  try {
    const { offsetNanoseconds } = Temporal.ZonedDateTime.from(value);
    return unit === "nanoseconds"
      ? offsetNanoseconds
      : offsetNanoseconds / NANOSECONDS_PER_MINUTE;
  } catch {
    return null;
  }
}
