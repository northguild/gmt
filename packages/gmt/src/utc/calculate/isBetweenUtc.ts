// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return true when `value` is between `start` and `end` (inclusive by default).
 *
 * - Uses Temporal.Instant.compare for comparison.
 * - Returns false if start > end or inputs are invalid.
 * - Use options.inclusiveStart/inclusiveEnd to control boundaries.
 *
 * @param value ISO UTC datetime string to check
 * @param start ISO UTC datetime string for range start
 * @param end ISO UTC datetime string for range end
 * @param options optional: inclusiveStart (boolean), inclusiveEnd (boolean)
 * @returns boolean indicating whether value is between start and end
 *
 * @example isBetweenUtc("2024-03-15T12:00:00Z", "2024-03-10T12:00:00Z", "2024-03-20T12:00:00Z") // true
 * @example isBetweenUtc("2024-03-25T12:00:00Z", "2024-03-10T12:00:00Z", "2024-03-20T12:00:00Z") // false
 * @example isBetweenUtc("invalid", "2024-03-10T12:00:00Z", "2024-03-20T12:00:00Z") // false
 */
export function isBetweenUtc(
  value: string,
  start: string,
  end: string,
  options?: { inclusiveStart?: boolean; inclusiveEnd?: boolean },
): boolean {
  if (!isOptionsArgument(options)) {
    return false;
  }

  // Only an omitted flag takes the `true` default. An explicit `null` is a value, and every
  // reading of it gives `false`: ECMA-402 reads a boolean option through ToBoolean (null → false),
  // and the house rule rejects an invalid member outright — neither yields `true`. So `null`
  // behaves here exactly as `0` and `""` already do.
  const inclusiveStart =
    options?.inclusiveStart === undefined ? true : options.inclusiveStart;
  const inclusiveEnd =
    options?.inclusiveEnd === undefined ? true : options.inclusiveEnd;

  if (!isValidUtc(value) || !isValidUtc(start) || !isValidUtc(end)) {
    return false;
  }

  let instant: Temporal.Instant;
  let startInstant: Temporal.Instant;
  let endInstant: Temporal.Instant;

  try {
    instant = Temporal.Instant.from(value);
    startInstant = Temporal.Instant.from(start);
    endInstant = Temporal.Instant.from(end);
  } catch {
    return false;
  }

  try {
    if (Temporal.Instant.compare(startInstant, endInstant) === 1) {
      return false;
    }

    const startCheck = inclusiveStart
      ? Temporal.Instant.compare(startInstant, instant) <= 0
      : Temporal.Instant.compare(startInstant, instant) < 0;
    const endCheck = inclusiveEnd
      ? Temporal.Instant.compare(instant, endInstant) <= 0
      : Temporal.Instant.compare(instant, endInstant) < 0;

    return startCheck && endCheck;
  } catch {
    return false;
  }
}
