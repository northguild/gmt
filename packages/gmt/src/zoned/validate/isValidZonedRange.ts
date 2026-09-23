// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isObject, isOptionsArgument, zonedDateTimeFrom } from "../../internal";
import { hasZonedDateTimeShape } from "../../internal/isoStringBody";

/**
 * Return true if `value1` and `value2` form a valid zoned range — both parseable as
 * ISO ZonedDateTime strings and the instant at `value1` is <= the instant at `value2`.
 *
 * - Both inputs must be valid ISO 8601 zoned datetime strings in extended format, as
 *   `isValidZonedDateTime` requires: basic format, a space or lower-case `t` separator, a
 *   lower-case `z` and a date without a time return `false`.
 * - Equal `value1 === value2` is valid when `options.allowEqual` is true.
 * - Comparison is done by instant, so intervals spanning DST transitions are compared
 *   by absolute time.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 * - Annotations are read as `isValidZonedDateTime` reads them: elective ones are ignored,
 *   `[u-ca=iso8601]` is accepted, and a non-ISO calendar on either endpoint returns `false`.
 *
 * @param value1 first ISO ZonedDateTime string
 * @param value2 second ISO ZonedDateTime string
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the zoned range is valid
 *
 * @example isValidZonedRange({ value1: "2024-01-01T10:00:00+00:00[UTC]", value2: "2024-12-31T23:59:59+00:00[UTC]" }) // true
 * @example isValidZonedRange({ value1: "2024-12-31T23:59:59+00:00[UTC]", value2: "2024-01-01T10:00:00+00:00[UTC]" }) // false
 * @example isValidZonedRange({ value1: "2024-06-15T12:00:00-04:00[America/New_York]", value2: "2024-06-15T12:00:00-04:00[America/New_York]", options: { allowEqual: true } }) // true
 * @example isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", value2: "2024-02-01T00:00:00+00:00[UTC]" }) // false (non-ISO calendar)
 * @example isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=iso8601]", value2: "2024-02-01T00:00:00+00:00[UTC]" }) // true
 * @example isValidZonedRange({ value1: "2024-01-01 10:00:00+00:00[UTC]", value2: "2024-12-31T23:59:59+00:00[UTC]" }) // false (space separator)
 */
export function isValidZonedRange(props: {
  value1: string;
  value2: string;
  options?: { allowEqual?: boolean };
}): boolean {
  try {
    if (!isObject(props)) return false;
    const { value1, value2, options } = props;
    if (!isOptionsArgument(options)) return false;

    if (typeof value1 !== "string" || typeof value2 !== "string") {
      return false;
    }

    if (
      isLeapSecond(value1) ||
      isLeapSecond(value2) ||
      !hasZonedDateTimeShape(value1) ||
      !hasZonedDateTimeShape(value2)
    ) {
      return false;
    }

    try {
      const zdt1 = zonedDateTimeFrom(value1);
      const zdt2 = zonedDateTimeFrom(value2);

      if (zdt1.calendarId !== "iso8601" || zdt2.calendarId !== "iso8601") {
        return false;
      }

      const instant1 = zdt1.toInstant();
      const instant2 = zdt2.toInstant();

      const cmp = Temporal.Instant.compare(instant1, instant2);

      if (options?.allowEqual) {
        return cmp <= 0;
      }

      return cmp < 0;
    } catch {
      return false;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
