import { Temporal } from "./temporal";
import { hasSecond60Field } from "./inputChecks";
import { utcDateTime } from "../regex/utc-date-time";

/**
 * The check behind `isValidUtc`: the `Instant` a strict ISO 8601 UTC date-time string names, or
 * `null`.
 *
 * The whole string must match `utcDateTime` (`…Z`, nothing after, no annotation of any kind) and
 * have no second 60; Temporal then reads the instant.
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
  if (hasSecond60Field(value) || !utcDateTime.test(value)) {
    return null;
  }
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}
