import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return true when `dateTime` is between `start` and `end` (inclusive by default).
 *
 * - Uses Temporal.PlainDateTime.compare to compare date-times.
 * - Returns false if start > end (invalid range).
 * - Returns false if any input is invalid.
 * - Use options.inclusiveStart and options.inclusiveEnd to control boundary inclusivity.
 *
 * @param dateTime ISO PlainDateTime string to check
 * @param start ISO PlainDateTime string for the start of the range
 * @param end ISO PlainDateTime string for the end of the range
 * @param options { inclusiveStart?: boolean = true, inclusiveEnd?: boolean = true }
 * @returns boolean indicating whether dateTime is between start and end
 *
 * @example isBetweenDateTime("2024-02-29T12:00:00", "2024-02-01T00:00:00", "2024-02-28T23:59:59") // false
 * @example isBetweenDateTime("2024-02-29T12:00:00", "2024-02-01T00:00:00", "2024-02-29T12:00:00") // true
 * @example isBetweenDateTime("2024-02-29T12:00:00", "2024-02-29T12:00:00", "2024-02-28T23:59:59") // false
 * @example isBetweenDateTime("2024-02-29T12:00:00", "2024-02-28T23:59:59", "2024-03-01T00:00:00") // true
 * @example isBetweenDateTime("invalid", "2024-02-01T00:00:00", "2024-02-28T23:59:59") // false
 * @example isBetweenDateTime("2024-02-29T12:00:00", "invalid", "2024-02-28T23:59:59") // false
 * @example isBetweenDateTime("2024-02-29T12:00:00", "2024-02-01T00:00:00", "invalid") // false
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
