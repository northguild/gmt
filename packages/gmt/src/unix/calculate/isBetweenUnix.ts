import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return true when the Unix timestamp is between start and end (inclusive by default).
 *
 * - Uses Temporal.Instant.compare for comparison.
 * - Returns false if start > end or inputs are invalid.
 * - Use options.inclusiveStart/inclusiveEnd to control boundaries.
 *
 * @param value Unix timestamp to check
 * @param start Unix timestamp for range start
 * @param end Unix timestamp for range end
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), inclusiveStart (boolean), inclusiveEnd (boolean)
 * @returns boolean indicating whether value is between start and end
 *
 * @example isBetweenUnix(1705000000000, 1704000000000, 1706000000000) // true
 * @example isBetweenUnix(1705000000, 1704000000, 1706000000, { epochUnit: "seconds" }) // true
 * @example isBetweenUnix(1703000000000, 1704000000000, 1706000000000) // false
 */
export function isBetweenUnix(
  value: number,
  start: number,
  end: number,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    inclusiveStart?: boolean;
    inclusiveEnd?: boolean;
  },
): boolean {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();
  const inclusiveStart = options?.inclusiveStart ?? true;
  const inclusiveEnd = options?.inclusiveEnd ?? true;

  if (!timeZone || !isValidTimeZone(timeZone)) return false;

  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    !Number.isFinite(start) ||
    !Number.isInteger(start) ||
    !Number.isFinite(end) ||
    !Number.isInteger(end)
  ) {
    return false;
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value * 1000 : value,
    );
    const startInstant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? start * 1000 : start,
    );
    const endInstant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? end * 1000 : end,
    );

    if (Temporal.Instant.compare(startInstant, endInstant) === 1) {
      return false;
    }

    const startCheck = inclusiveStart
      ? Temporal.Instant.compare(startInstant, instant) <= 0
      : Temporal.Instant.compare(startInstant, instant) < 0;
    const endCheck = inclusiveEnd
      ? Temporal.Instant.compare(instant, endInstant) <= 0
      : Temporal.Instant.compare(instant, endInstant) < 0;

    return startCheck && endCheck;
  } catch {
    return false;
  }
}
