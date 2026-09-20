// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return true when `zoned` is between `start` and `end` (inclusive by default).
 *
 * - Validates inputs and then compares using Temporal.Instant (same instant semantics).
 * - Returns false for invalid inputs.
 *
 * @param zoned ISO ZonedDateTime string to check
 * @param start ISO ZonedDateTime string for the start of the range
 * @param end ISO ZonedDateTime string for the end of the range
 * @param options optional: inclusiveStart (boolean), inclusiveEnd (boolean)
 * @returns boolean indicating whether zoned is between start and end
 *
 * @example isBetweenZoned("2024-02-29T12:00:00+00:00[UTC]", "2024-02-29T11:00:00+00:00[UTC]", "2024-02-29T13:00:00+00:00[UTC]") // true
 * @example isBetweenZoned("invalid", "2024-02-29T11:00:00+00:00[UTC]", "2024-02-29T13:00:00+00:00[UTC]") // false
 */
export function isBetweenZoned(
  zoned: string,
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

  if (
    !isValidZonedDateTime(zoned) ||
    !isValidZonedDateTime(start) ||
    !isValidZonedDateTime(end)
  ) {
    return false;
  }

  let zdt: Temporal.ZonedDateTime;
  let startZdt: Temporal.ZonedDateTime;
  let endZdt: Temporal.ZonedDateTime;

  try {
    zdt = zonedDateTimeFrom(zoned);
    startZdt = zonedDateTimeFrom(start);
    endZdt = zonedDateTimeFrom(end);
  } catch {
    return false;
  }

  try {
    const startInstant = startZdt.toInstant();
    const endInstant = endZdt.toInstant();
    const zonedInstant = zdt.toInstant();

    if (Temporal.Instant.compare(startInstant, endInstant) === 1) {
      return false;
    }

    const startCheck = inclusiveStart
      ? Temporal.Instant.compare(startInstant, zonedInstant) <= 0
      : Temporal.Instant.compare(startInstant, zonedInstant) < 0;
    const endCheck = inclusiveEnd
      ? Temporal.Instant.compare(zonedInstant, endInstant) <= 0
      : Temporal.Instant.compare(zonedInstant, endInstant) < 0;

    return startCheck && endCheck;
  } catch {
    return false;
  }
}
