import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return true when `date` is between `start` and `end` (inclusive by default).
 *
 * - Uses Temporal.PlainDate.compare to compare dates.
 * - Returns false if start > end (invalid range).
 * - Returns false if any input is invalid.
 * - Use options.inclusiveStart and options.inclusiveEnd to control boundary inclusivity.
 *
 * @param date ISO PlainDate string to check
 * @param start ISO PlainDate string for the start of the range
 * @param end ISO PlainDate string for the end of the range
 * @param options { inclusiveStart?: boolean = true, inclusiveEnd?: boolean = true }
 * @returns boolean indicating whether date is between start and end
 *
 * @example isBetweenDate("2024-02-29", "2024-02-01", "2024-02-28") // false
 * @example isBetweenDate("2024-02-29", "2024-02-01", "2024-02-29") // true
 * @example isBetweenDate("2024-02-29", "2024-02-29", "2024-02-28") // false
 * @example isBetweenDate("2024-02-29", "2024-02-28", "2024-03-01") // true
 * @example isBetweenDate("invalid", "2024-02-01", "2024-02-28") // false
 * @example isBetweenDate("2024-02-29", "invalid", "2024-02-28") // false
 * @example isBetweenDate("2024-02-29", "2024-02-01", "invalid") // false
 */
export function isBetweenDate(
  date: string,
  start: string,
  end: string,
  options?: {
    inclusiveStart?: boolean;
    inclusiveEnd?: boolean;
  },
): boolean {
  const inclusiveStart = options?.inclusiveStart ?? true;
  const inclusiveEnd = options?.inclusiveEnd ?? true;

  if (!isValidDate(date) || !isValidDate(start) || !isValidDate(end)) {
    return false;
  }

  try {
    const d = Temporal.PlainDate.from(date);
    const s = Temporal.PlainDate.from(start);
    const e = Temporal.PlainDate.from(end);

    if (Temporal.PlainDate.compare(s, e) === 1) {
      return false;
    }

    const startCheck = inclusiveStart
      ? Temporal.PlainDate.compare(s, d) <= 0
      : Temporal.PlainDate.compare(s, d) < 0;
    const endCheck = inclusiveEnd
      ? Temporal.PlainDate.compare(d, e) <= 0
      : Temporal.PlainDate.compare(d, e) < 0;

    return startCheck && endCheck;
  } catch {
    return false;
  }
}
