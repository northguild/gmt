import { Temporal } from "./temporal";
import { instantLeapSecond } from "../regex/leap-second";
import { hasInstantShape } from "./isoStringBody";

/**
 * Parse an ISO 8601 instant string to epoch nanoseconds, or `null` when it is not one.
 *
 * The single definition of "an instant string GMT accepts", and of the instant it names. Every
 * GMT function that reads a moment without keeping its zone reads through here.
 *
 * **Which strings.** The RFC 9557 instant grammar `Temporal.Instant.from` parses, restricted to
 * ISO 8601 extended format before the first `[` (`instantBody`: `<date>T<time>`, then `Z` or
 * `±HH:MM[:SS[.fraction]]`), minus leap seconds (which Temporal clamps rather than rejects).
 * Basic format, a space or lower-case `t` separator, a lower-case `z` and an hour-only time or
 * offset are rejected.
 *
 * **Which annotations.** None. An instant is exactly `<date>T<time>` then `Z` or an offset, over
 * the whole string: a time-zone annotation (`[Europe/Helsinki]`, `[!Not/AZone]`, `[+02:00]`), a
 * calendar annotation (`[u-ca=hebrew]`) and an elective one (`[foo=bar]`) each make the string
 * invalid. A function that keeps the zone reads a zoned string through the zoned readers.
 *
 * **Which instant.** The written `Z` or offset fixes it, exactly as in `Temporal.Instant.from`.
 *
 * Callers layer their own sentinel on top — `toNanoseconds` returns `0n`, `spanNs` returns
 * `null` — so the parse result stays unambiguous here.
 *
 * @param value candidate ISO 8601 instant string
 * @returns nanoseconds since the Unix epoch, or null when `value` is not a valid instant
 *
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z") // 0n
 * @example parseInstantNanoseconds("2016-12-31T23:59:60Z") // null — leap second
 * @example parseInstantNanoseconds("2024-03-10T12:00:00") // null — no offset designator
 * @example parseInstantNanoseconds("20240310T120000Z") // null — basic format
 * @example parseInstantNanoseconds("2024-03-10T12:00:00z") // null — lower-case z
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z[u-ca=hebrew]") // null — no annotation of any kind
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z[Europe/London]") // null — a zone annotation is not an instant
 * @example parseInstantNanoseconds("1970-01-01T01:00:00+01:00") // 0n — the written offset fixes the instant
 */
export function parseInstantNanoseconds(value: string): bigint | null {
  if (
    typeof value !== "string" ||
    instantLeapSecond.test(value) ||
    !hasInstantShape(value)
  ) {
    return null;
  }

  try {
    return Temporal.Instant.from(value).epochNanoseconds;
  } catch {
    return null;
  }
}

/**
 * The check behind `isValidInstant`: the `Temporal.Instant` `parseInstantNanoseconds` reads, or
 * `null`.
 *
 * @param value the candidate; a value that is not a string is not an instant
 * @returns the instant the string names, else `null`
 *
 * @example instantOf("1970-01-01T00:00:00Z")?.epochNanoseconds // 0n
 * @example instantOf("2024-03-10T12:00:00") // null
 * @example instantOf(null) // null
 */
export function instantOf(value: unknown): Temporal.Instant | null {
  if (typeof value !== "string") {
    return null;
  }
  const nanoseconds = parseInstantNanoseconds(value);
  return nanoseconds === null
    ? null
    : Temporal.Instant.fromEpochNanoseconds(nanoseconds);
}

/**
 * `parseInstantNanoseconds` as a `Temporal.Instant`, for callers that already hold a validated
 * string and go on to Temporal arithmetic. Use it wherever a caller's instant string would
 * otherwise go to `Temporal.Instant.from`, so a zone annotation is refused the same way
 * everywhere. Throws where `Temporal.Instant.from` throws, so it sits inside the caller's `try`
 * like any other Temporal parse.
 *
 * @param value ISO 8601 instant string
 * @returns the instant the string names
 * @throws RangeError when `value` is not a valid instant
 *
 * @example instantFrom("1960-01-01T00:20:00-00:45").toString() // "1960-01-01T01:05:00Z"
 * @example instantFrom("1960-01-01T00:20:00-00:45[Africa/Monrovia]") // throws RangeError
 * @example instantFrom("2024-06-15T10:00:00") // throws RangeError
 */
export function instantFrom(value: string): Temporal.Instant {
  const instant = instantOf(value);
  if (instant === null) {
    throw new RangeError("Not an ISO 8601 instant string");
  }
  return instant;
}

/**
 * The core of `spanNs`: the nanoseconds from one instant string to another. Never throws.
 *
 * @returns what `spanNs` returns, for the same arguments
 */
export function spanNanoseconds(start: string, end: string): bigint | null {
  const startNanoseconds = parseInstantNanoseconds(start);
  const endNanoseconds = parseInstantNanoseconds(end);

  if (startNanoseconds === null || endNanoseconds === null) {
    return null;
  }

  return endNanoseconds - startNanoseconds;
}
