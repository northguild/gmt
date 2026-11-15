import { Temporal } from "./temporal";

/**
 * `Temporal.Duration.from`, except that a string must write its designators in upper case.
 *
 * ISO 8601-1 writes the designators P, Y, M, W, D, T, H and S in upper case; Temporal's
 * `ParseTemporalDurationString` also reads them in lower case (`p1d`, `pt1h`), which GMT never
 * copies. A lower-case letter has no other place in a duration string (the grammar has no
 * exponent), so any of them is refused. The decimal comma (ISO 8601-1) stays.
 *
 * @param value an ISO 8601 duration string, a `Temporal.Duration` or a duration-like object
 * @returns the duration
 * @throws RangeError when the string has a lower-case letter, or when Temporal refuses the value
 *
 * @example durationFrom("PT1H30M").toString() // "PT1H30M"
 * @example durationFrom("PT0,5H").toString() // "PT30M"
 * @example durationFrom("pt1h") // throws RangeError
 * @example durationFrom("P1d") // throws RangeError
 */
export function durationFrom(
  value: string | Temporal.Duration | Temporal.DurationLike,
): Temporal.Duration {
  if (typeof value === "string" && /[a-z]/.test(value)) {
    throw new RangeError(`Invalid duration: ${value}`);
  }
  return Temporal.Duration.from(value);
}
