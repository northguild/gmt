import { Temporal } from "@js-temporal/polyfill";

// Convert a UTC ISO datetime string to a Temporal.Instant.
// Returns null on failure (caller should have already validated with isValidUtc).
export function toInstantFromUtc(value: string): Temporal.Instant | null {
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}

/**
 * Resolve a `reference` option to an instant: the parsed UTC string when one is given, else now.
 *
 * @param reference a UTC ISO string the caller has validated, or undefined (and `""`) for now
 * @returns the instant, or null when the string does not parse or the clock is unavailable
 * @example toReferenceInstantFromUtc("2024-03-15T12:00:00Z")?.toString() // "2024-03-15T12:00:00Z"
 * @example toReferenceInstantFromUtc(undefined) instanceof Temporal.Instant // true (now)
 * @example toReferenceInstantFromUtc("not-a-date") // null
 */
export function toReferenceInstantFromUtc(
  reference: string | undefined,
): Temporal.Instant | null {
  if (reference) return toInstantFromUtc(reference);
  try {
    return Temporal.Now.instant();
  } catch {
    return null;
  }
}
