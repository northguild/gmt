import { Temporal } from "./temporal";
import { isValidEpochNanoseconds } from "./epochNanoseconds";
import { isZoneId } from "./inputChecks";
import type { NanosecondTruncationUnit } from "../precision/calculate/truncateNanoseconds";

/**
 * The core of every reader that turns an epoch-nanosecond count into a UTC instant string
 * (`fromNanoseconds` without a zone, the identifier and foreign-epoch readers). Returns "" for
 * `null`, for a value that is not a `bigint` (the polyfill would coerce a number or a string,
 * so the type is checked first) and for a count outside the range `Temporal.Instant` holds
 * (`fromEpochNanoseconds` throws there).
 */
export function instantStringFromEpochNanoseconds(
  nanoseconds: bigint | null,
): string {
  if (typeof nanoseconds !== "bigint") {
    return "";
  }

  try {
    return Temporal.Instant.fromEpochNanoseconds(nanoseconds).toString();
  } catch {
    return "";
  }
}

/**
 * The core of `fromNanoseconds`: an epoch-nanosecond count as an instant string, or as a zoned
 * string when `timeZone` is given. Never throws.
 *
 * @returns what `fromNanoseconds` returns, for the same arguments
 *
 * @example zonedStringFromEpochNanoseconds(0n) // "1970-01-01T00:00:00Z"
 * @example zonedStringFromEpochNanoseconds(0n, "Asia/Tokyo") // "1970-01-01T09:00:00+09:00[Asia/Tokyo]"
 */
export function zonedStringFromEpochNanoseconds(
  nanoseconds: bigint,
  timeZone?: string,
): string {
  // An explicit `undefined` is the same as omitting the argument (TC39 optional parameters).
  if (timeZone === undefined) {
    return instantStringFromEpochNanoseconds(nanoseconds);
  }

  if (
    !isValidEpochNanoseconds(nanoseconds) ||
    typeof timeZone !== "string" ||
    !isZoneId(timeZone)
  ) {
    return "";
  }

  try {
    return Temporal.Instant.fromEpochNanoseconds(nanoseconds)
      .toZonedDateTimeISO(timeZone)
      .toString();
  } catch {
    return "";
  }
}

const NANOSECONDS_PER_UNIT: Record<NanosecondTruncationUnit, bigint> = {
  ms: 1_000_000n,
  us: 1_000n,
};

/**
 * The core of `truncateNanoseconds`: a count rounded toward the past to a millisecond or
 * microsecond boundary. Never throws.
 *
 * @returns what `truncateNanoseconds` returns, for the same arguments
 *
 * @example truncateEpochNanoseconds(1_234_567n, "ms") // 1_000_000n
 */
export function truncateEpochNanoseconds(
  nanoseconds: bigint,
  unit: NanosecondTruncationUnit,
): bigint {
  if (!isValidEpochNanoseconds(nanoseconds)) {
    return 0n;
  }

  if (unit !== "ms" && unit !== "us") {
    return 0n;
  }

  const divisor = NANOSECONDS_PER_UNIT[unit];
  const remainder = ((nanoseconds % divisor) + divisor) % divisor;

  return nanoseconds - remainder;
}
