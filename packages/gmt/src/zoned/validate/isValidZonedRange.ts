import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return true if `value1` and `value2` form a valid zoned range — both parseable as
 * ISO ZonedDateTime strings and the instant at `value1` is <= the instant at `value2`.
 *
 * - Both inputs must be valid ISO 8601 zoned datetime strings.
 * - Equal `value1 === value2` is valid when `options.allowEqual` is true.
 * - Comparison is done by instant, so intervals spanning DST transitions are compared
 *   by absolute time.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param value1 first ISO ZonedDateTime string
 * @param value2 second ISO ZonedDateTime string
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the zoned range is valid
 *
 * @example isValidZonedRange({ value1: "2024-01-01T10:00:00+00:00[UTC]", value2: "2024-12-31T23:59:59+00:00[UTC]" }) // true
 * @example isValidZonedRange({ value1: "2024-12-31T23:59:59+00:00[UTC]", value2: "2024-01-01T10:00:00+00:00[UTC]" }) // false
 * @example isValidZonedRange({ value1: "2024-06-15T12:00:00-04:00[America/New_York]", value2: "2024-06-15T12:00:00-04:00[America/New_York]", options: { allowEqual: true } }) // true
 */
export function isValidZonedRange({
  value1,
  value2,
  options,
}: {
  value1: string;
  value2: string;
  options?: { allowEqual?: boolean };
}): boolean {
  if (typeof value1 !== "string" || typeof value2 !== "string") {
    return false;
  }

  if (isLeapSecond(value1) || isLeapSecond(value2)) {
    return false;
  }

  try {
    const zdt1 = Temporal.ZonedDateTime.from(value1);
    const zdt2 = Temporal.ZonedDateTime.from(value2);

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
}
