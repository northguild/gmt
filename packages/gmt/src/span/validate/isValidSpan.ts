import { parseInstantNanoseconds } from "../../internal";

/**
 * Validate whether two ISO 8601 instant strings form a measurable span.
 *
 * True exactly when `spanMs` and `spanNs` will return a value rather than `null` — the
 * endpoints both parse, so there is an elapsed time between them.
 *
 * - Accepts what `toNanoseconds` does on both sides: an offset designator is required,
 *   optionally followed by a bracketed IANA zone; no leap seconds, no `[u-ca=...]`
 *   calendar annotations. The two endpoints need not share a zone.
 * - Order does not matter. A span is signed, not invalid, when `start` is after `end`, so
 *   this is symmetric.
 * - **`spanMs` can still return `null` on a pair this accepts** — a span wider than
 *   `Number.MAX_SAFE_INTEGER` milliseconds has no `number` to return. That is a range
 *   limit on the result, not a defect in the inputs, and `spanNs` returns the exact
 *   `bigint` for the same pair.
 * - Does **not** validate `spanWallClock`, which needs a bracketed IANA zone on both
 *   endpoints rather than a bare offset — that is `isValidZonedDateTime`.
 * - Returns `false` for non-strings and empty strings.
 *
 * @param start candidate ISO 8601 instant string the span would be measured from
 * @param end candidate ISO 8601 instant string the span would be measured to
 * @returns boolean indicating whether spanMs/spanNs will measure this pair
 *
 * @example isValidSpan("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z") // true
 * @example isValidSpan("2024-03-10T12:00:00Z", "2024-03-10T12:00:00Z") // true — a zero span is a span
 * @example isValidSpan("2024-03-10T12:00:01Z", "2024-03-10T12:00:00Z") // true — spans are signed
 * @example isValidSpan("2024-03-10T07:00:00-05:00[America/New_York]", "2024-03-10T12:00:00Z") // true
 * @example isValidSpan("-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z") // true — but spanMs returns null, use spanNs
 * @example isValidSpan("2024-03-10T12:00:00Z", "invalid") // false
 * @example isValidSpan("2024-03-10T12:00:00[America/New_York]", "2024-03-11T12:00:00[America/New_York]") // false — no offset designator
 */
export function isValidSpan(start: string, end: string): boolean {
  return (
    parseInstantNanoseconds(start) !== null &&
    parseInstantNanoseconds(end) !== null
  );
}
