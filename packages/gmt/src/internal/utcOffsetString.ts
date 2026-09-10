import { Temporal } from "@js-temporal/polyfill";
import { utcOffset } from "../regex/utc-offset";

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_MINUTE = 60n;
const SECONDS_PER_HOUR = 3600n;
const SECONDS_PER_DAY = 86_400n;

function padTwo(value: bigint): string {
  return value.toString().padStart(2, "0");
}

/**
 * Parse a `±HH:MM[:SS]` UTC offset to the nanoseconds local time runs ahead of UTC.
 *
 * Temporal exposes no offset parser of its own — `offsetNanoseconds` is only ever read off a
 * `ZonedDateTime`, which needs a zone GMT does not have here. So the offset is read the one
 * way Temporal will read it: as the offset half of an instant string anchored at the epoch.
 * `1970-01-01T00:00:00-04:00` *is* `1970-01-01T04:00:00Z`, so the epoch nanoseconds of that
 * instant are the offset with its sign flipped. The regex proves the shape and Temporal does
 * the parsing, so no offset digits are ever sliced by hand.
 *
 * @param offset `±HH:MM` or `±HH:MM:SS` offset string
 * @returns nanoseconds ahead of UTC (negative west of it), or null when `offset` is not one
 *
 * @example parseUtcOffsetNanoseconds("-04:00") // -14400000000000n
 * @example parseUtcOffsetNanoseconds("+05:45") // 20700000000000n
 * @example parseUtcOffsetNanoseconds("Z") // null — a designator, not an offset
 */
export function parseUtcOffsetNanoseconds(offset: string): bigint | null {
  if (typeof offset !== "string" || !utcOffset.test(offset)) {
    return null;
  }

  try {
    return -Temporal.Instant.from(`1970-01-01T00:00:00${offset}`)
      .epochNanoseconds;
  } catch {
    return null;
  }
}

/**
 * Format nanoseconds ahead of UTC as a canonical `±HH:MM[:SS]` offset string.
 *
 * The inverse of `parseUtcOffsetNanoseconds`, and the canonicaliser both halves of the
 * offset-instant pair route through — `+05:45:00` and `+05:45` name one offset, and only one
 * of them is what GMT stores.
 *
 * - Emits the `:SS` field only when the offset is not a whole number of minutes, matching
 *   `Temporal.ZonedDateTime.prototype.offset`.
 * - Returns null for an offset finer than a second, or at or beyond ±24 hours — neither is a
 *   value any zone or standard that stores this pair has ever used.
 *
 * @param offsetNanoseconds nanoseconds local time runs ahead of UTC
 * @returns `±HH:MM[:SS]` offset string, or null when the value is not one GMT stores
 *
 * @example formatUtcOffset(-14400000000000n) // "-04:00"
 * @example formatUtcOffset(0n) // "+00:00"
 * @example formatUtcOffset(-2670000000000n) // "-00:44:30"
 * @example formatUtcOffset(1n) // null — finer than a second
 */
export function formatUtcOffset(offsetNanoseconds: bigint): string | null {
  if (offsetNanoseconds % NANOSECONDS_PER_SECOND !== 0n) {
    return null;
  }

  const totalSeconds = offsetNanoseconds / NANOSECONDS_PER_SECOND;
  const magnitude = totalSeconds < 0n ? -totalSeconds : totalSeconds;

  if (magnitude >= SECONDS_PER_DAY) {
    return null;
  }

  const sign = totalSeconds < 0n ? "-" : "+";
  const hours = magnitude / SECONDS_PER_HOUR;
  const minutes = (magnitude / SECONDS_PER_MINUTE) % SECONDS_PER_MINUTE;
  const seconds = magnitude % SECONDS_PER_MINUTE;

  return seconds === 0n
    ? `${sign}${padTwo(hours)}:${padTwo(minutes)}`
    : `${sign}${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}
