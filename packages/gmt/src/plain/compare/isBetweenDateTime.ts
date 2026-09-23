// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

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
  options?: { inclusiveStart?: boolean; inclusiveEnd?: boolean },
): boolean {
  try {
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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
