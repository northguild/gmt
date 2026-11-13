import { Temporal } from "./temporal";
import { hasSecond60Field } from "./inputChecks";
import { isoStringBody } from "./isoStringBody";
import { utcDateTime } from "../regex/utc-date-time";

/**
 * The check behind `isValidUtc`: the `Instant` a strict ISO 8601 UTC date-time string names, or
 * `null`.
 *
 * The part before the first annotation must match `utcDateTime` and the string must have no
 * second 60; Temporal then reads the instant and the annotations.
 *
 * @param value the candidate; a value that is not a string is not a UTC string
 * @returns the `Instant` Temporal reads, else `null`
 *
 * @example utcInstantOf("2024-03-10T12:00:00Z")?.epochMilliseconds // 1710072000000
 * @example utcInstantOf("2024-03-10T12:00:00") // null
 * @example utcInstantOf(null) // null
 */
export function utcInstantOf(value: unknown): Temporal.Instant | null {
  if (typeof value !== "string") {
    return null;
  }
  const body = isoStringBody(value);
  if (hasSecond60Field(body) || !utcDateTime.test(body)) {
    return null;
  }
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}
