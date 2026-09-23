import { Temporal } from "@js-temporal/polyfill";

/**
 * Epoch milliseconds for a UTC instant string — how a fixture names a moment.
 *
 * GMT already exports this as `convertUtcToUnix`, and using it here would be a
 * circular oracle. `setUnix.test.ts` shows why concretely: it feeds a converted
 * instant in and compares against a converted instant out.
 *
 *     const value = convertUtcToUnix("2024-01-31T12:00:00Z");
 *     expect(setUnix(value, …)).toBe(convertUtcToUnix("2024-02-05T12:00:00Z"));
 *
 * If `convertUtcToUnix` were an hour out, both sides would shift by that hour
 * and the test would still pass. A fixture built by the library cannot catch
 * the library being wrong.
 *
 * `Temporal` is the independent dependency GMT wraps, and is already what this
 * suite reaches for when it needs an oracle. This replaces
 * `Date.UTC(2024, 2, 15)`, whose zero-based month reads as February and means
 * March — a fixture for a date library should not depend on getting that right.
 */
export function utcMs(utc: string): number {
  return Temporal.Instant.from(utc).epochMilliseconds;
}
