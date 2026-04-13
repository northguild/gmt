import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return true when `zoned` is between `start` and `end` (inclusive by default).
 *
 * - Validates inputs and then compares using Temporal.Instant (same instant semantics).
 * - Returns false for invalid inputs.
 *
 * @param zoned ISO ZonedDateTime string to check
 * @param start ISO ZonedDateTime string for the start of the range
 * @param end ISO ZonedDateTime string for the end of the range
 * @param options { inclusiveStart?: boolean = true, inclusiveEnd?: boolean = true }
 * @returns boolean indicating whether zoned is between start and end
 */
export function isBetweenZoned(
  zoned: string,
  start: string,
  end: string,
  options?: {
    inclusiveStart?: boolean;
    inclusiveEnd?: boolean;
  },
): boolean {
  const inclusiveStart = options?.inclusiveStart ?? true;
  const inclusiveEnd = options?.inclusiveEnd ?? true;

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
    zdt = Temporal.ZonedDateTime.from(zoned);
    startZdt = Temporal.ZonedDateTime.from(start);
    endZdt = Temporal.ZonedDateTime.from(end);
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
