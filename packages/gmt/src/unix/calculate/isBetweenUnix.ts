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
 * - Each value is a safe integer or a digit string (`"1705000000000"`); anything else returns false.
 *
 * @param value Unix epoch to check: a safe integer, or a string of optionally negative ASCII digits
 * @param start Unix epoch for range start, in the same form and unit
 * @param end Unix epoch for range end, in the same form and unit
 * @param options optional: how the epochs are read and whether each end of the range is included
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
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns false.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * A time zone that is validated only: the comparison is on exact instants, so the zone never
     * changes the result. It is an IANA name, a UTC offset, or `"local"` for the system time zone.
     * An unknown zone returns false.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
    /**
     * Whether `value` equal to `start` counts as inside the range. `false` requires it to be after
     * `start`.
     *
     * @defaultValue `true`
     */
    inclusiveStart?: boolean;
    /**
     * Whether `value` equal to `end` counts as inside the range. `false` requires it to be before
     * `end`.
     *
     * @defaultValue `true`
     */
    inclusiveEnd?: boolean;
  },
): boolean {
  try {
    if (!isOptionsArgument(options)) {
      return false;
    }

    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const timeZone = normalizeTimeZone(options?.timeZone);
    // Only an omitted flag takes the `true` default. An explicit `null` is a value, and every
    // reading of it gives `false`: ECMA-402 reads a boolean option through ToBoolean (null → false),
    // and the house rule rejects an invalid member outright — neither yields `true`. So `null`
    // behaves here exactly as `0` and `""` already do.
    const inclusiveStart =
      options?.inclusiveStart === undefined ? true : options.inclusiveStart;
    const inclusiveEnd =
      options?.inclusiveEnd === undefined ? true : options.inclusiveEnd;

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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
