import { Temporal } from "./temporal";

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
