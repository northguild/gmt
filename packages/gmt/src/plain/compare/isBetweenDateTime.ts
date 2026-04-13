import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return true when `dateTime` is between `start` and `end` (inclusive by default).
 *
 * - Validates inputs and then compares using Temporal.PlainDateTime.compare.
 * - Returns false for invalid inputs.
 *
 * @param dateTime ISO PlainDateTime string to check
 * @param start ISO PlainDateTime string for the start of the range
 * @param end ISO PlainDateTime string for the end of the range
 * @param options { inclusiveStart?: boolean = true, inclusiveEnd?: boolean = true }
 * @returns boolean indicating whether dateTime is between start and end
 */
export function isBetweenDateTime(
  dateTime: string,
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
    !isValidDateTime(dateTime) ||
    !isValidDateTime(start) ||
    !isValidDateTime(end)
  ) {
    return false;
  }

  try {
    const d = Temporal.PlainDateTime.from(dateTime);
    const s = Temporal.PlainDateTime.from(start);
    const e = Temporal.PlainDateTime.from(end);

    if (Temporal.PlainDateTime.compare(s, e) === 1) {
      return false;
    }

    const startCheck = inclusiveStart
      ? Temporal.PlainDateTime.compare(s, d) <= 0
      : Temporal.PlainDateTime.compare(s, d) < 0;
    const endCheck = inclusiveEnd
      ? Temporal.PlainDateTime.compare(d, e) <= 0
      : Temporal.PlainDateTime.compare(d, e) < 0;

    return startCheck && endCheck;
  } catch {
    return false;
  }
}
