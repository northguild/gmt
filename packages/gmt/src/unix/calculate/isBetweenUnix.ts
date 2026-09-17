// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return true when the Unix timestamp is between start and end (inclusive by default).
 *
 * - Uses Temporal.Instant.compare for comparison.
 * - Returns false if start > end or inputs are invalid.
 * - Use options.inclusiveStart/inclusiveEnd to control boundaries.
 * - Each value is a safe integer or a digit string (`"1705000000000"`); anything else returns false.
 * - `timeZone` is only validated (the comparison is on exact instants): omitted is UTC, `"local"`
 *   the system zone, and an unknown zone returns false.
 *
 * @param value Unix epoch to check: a safe integer, or a string of optionally negative ASCII digits
 * @param start Unix epoch for range start, in the same form and unit
 * @param end Unix epoch for range end, in the same form and unit
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC" — only validated, the comparison is on exact instants), inclusiveStart (boolean), inclusiveEnd (boolean)
 * @returns boolean indicating whether value is between start and end
 *
 * @example isBetweenUnix(1705000000000, 1704000000000, 1706000000000) // true
 * @example isBetweenUnix(1705000000, 1704000000, 1706000000, { epochUnit: "seconds" }) // true
 * @example isBetweenUnix(1703000000000, 1704000000000, 1706000000000) // false
 * @example isBetweenUnix("1705000000", "1704000000", "1706000000", { epochUnit: "second" }) // true (digit strings)
 * @example isBetweenUnix(1705000000000, 1704000000000, 1706000000000, { timeZone: "Mars/Olympus" }) // false (unknown zone)
 */
export function isBetweenUnix(
  value: number | string,
  start: number | string,
  end: number | string,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    inclusiveStart?: boolean;
    inclusiveEnd?: boolean;
  },
): boolean {
  if (!isOptionsArgument(options)) {
    return false;
  }

  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const timeZone = normalizeTimeZone(options?.timeZone);
  const inclusiveStart = options?.inclusiveStart ?? true;
  const inclusiveEnd = options?.inclusiveEnd ?? true;

  if (!timeZone || epochUnit === null) return false;

  const instant = unixEpochToInstant(value, epochUnit);
  const startInstant = unixEpochToInstant(start, epochUnit);
  const endInstant = unixEpochToInstant(end, epochUnit);

  if (instant === null || startInstant === null || endInstant === null) {
    return false;
  }

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
}
