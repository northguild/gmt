import { Temporal } from "@js-temporal/polyfill";
import { isValidEpochNanoseconds } from "../../internal";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Convert nanoseconds since the Unix epoch back to an ISO 8601 string.
 *
 * - Returns a UTC instant string when no time zone is given, and a zoned string
 *   (`"...[America/New_York]"`) when one is.
 * - No disambiguation policy applies: an instant maps to exactly one wall time in a zone,
 *   so DST gaps and overlaps cannot arise on this direction of the conversion.
 * - A time zone, when given, must be a time zone identifier: an IANA name or a UTC offset to the
 *   minute. `undefined` is the same as omitting it (UTC), as TC39 treats an undefined argument as
 *   absent.
 * - Rejects values outside the range `Temporal.Instant` can represent
 *   (±8_640_000_000_000_000_000_000n, i.e. ±10^8 days from the epoch).
 * - **Storage round-trip:** most engines cannot hold nanoseconds — PostgreSQL `timestamptz`
 *   stores microseconds — so writing this value and reading it back breaks equality unless
 *   the caller applies `truncateNanoseconds` to the target precision first.
 * - Returns "" on invalid input.
 * - An offset with seconds (`-00:44:30`) returns `""`. A written zone cannot carry seconds (RFC
 *   9557 §4.1), so the result could not name it. Pass the IANA name, or call
 *   `fromOffsetInstant({ instant, offset })` for the local time with its full offset and no
 *   bracket.
 *
 * @param nanoseconds nanoseconds since the Unix epoch (bigint)
 * @param timeZone optional IANA name or a UTC offset to the minute (what `isValidTimeZone`
 *   accepts); omitted or `undefined` is UTC
 * @returns ISO 8601 instant string (UTC), zoned ISO 8601 string when a timeZone is given, or "" on invalid input
 *
 * @example fromNanoseconds(0n) // "1970-01-01T00:00:00Z"
 * @example fromNanoseconds(1710072000123456789n) // "2024-03-10T12:00:00.123456789Z"
 * @example fromNanoseconds(1710072000123456789n, "America/New_York") // "2024-03-10T08:00:00.123456789-04:00[America/New_York]"
 * @example fromNanoseconds(-1000000000n) // "1969-12-31T23:59:59Z"
 * @example fromNanoseconds(0n, "Not/AZone") // ""
 * @example fromNanoseconds(0n, undefined) // "1970-01-01T00:00:00Z" — undefined is the same as omitted
 * @example fromNanoseconds(1710072000123456789) // "" — number, not bigint
 */
export function fromNanoseconds(
  nanoseconds: bigint,
  timeZone?: string,
): string {
  if (!isValidEpochNanoseconds(nanoseconds)) {
    return "";
  }

  // An explicit `undefined` is the same as omitting the argument (TC39 optional parameters).
  if (
    timeZone !== undefined &&
    (typeof timeZone !== "string" || !isValidTimeZone(timeZone))
  ) {
    return "";
  }

  try {
    const instant = Temporal.Instant.fromEpochNanoseconds(nanoseconds);

    return typeof timeZone === "string"
      ? instant.toZonedDateTimeISO(timeZone).toString()
      : instant.toString();
  } catch {
    return "";
  }
}
