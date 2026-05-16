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
