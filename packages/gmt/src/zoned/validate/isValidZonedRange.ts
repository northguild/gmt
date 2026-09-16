import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import {
  hasCalendarAnnotation,
  isObject,
  zonedDateTimeFrom,
} from "../../internal";

/**
 * Return true if `value1` and `value2` form a valid zoned range — both parseable as
 * ISO ZonedDateTime strings and the instant at `value1` is <= the instant at `value2`.
 *
 * - Both inputs must be valid ISO 8601 zoned datetime strings.
 * - Equal `value1 === value2` is valid when `options.allowEqual` is true.
 * - Comparison is done by instant, so intervals spanning DST transitions are compared
 *   by absolute time.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 * - A `[u-ca=...]` calendar annotation on either endpoint returns `false`, exactly as
 *   `isValidZonedDateTime` rejects it (E5 decision D2), so this never certifies a value the rest
 *   of `zoned/` refuses. Compatibility: earlier releases accepted and ignored the annotation;
 *   to keep that, remove it first with `value.replace(/\[!?u-ca=[^\]]*\]/g, "")`.
 *
 * @param value1 first ISO ZonedDateTime string
 * @param value2 second ISO ZonedDateTime string
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the zoned range is valid
 *
 * @example isValidZonedRange({ value1: "2024-01-01T10:00:00+00:00[UTC]", value2: "2024-12-31T23:59:59+00:00[UTC]" }) // true
 * @example isValidZonedRange({ value1: "2024-12-31T23:59:59+00:00[UTC]", value2: "2024-01-01T10:00:00+00:00[UTC]" }) // false
 * @example isValidZonedRange({ value1: "2024-06-15T12:00:00-04:00[America/New_York]", value2: "2024-06-15T12:00:00-04:00[America/New_York]", options: { allowEqual: true } }) // true
 * @example isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", value2: "2024-02-01T00:00:00+00:00[UTC]" }) // false (calendar annotation)
 * @example isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]".replace(/\[!?u-ca=[^\]]*\]/g, ""), value2: "2024-02-01T00:00:00+00:00[UTC]" }) // true (annotation removed)
 */
export function isValidZonedRange(props: {
  value1: string;
  value2: string;
  options?: { allowEqual?: boolean };
}): boolean {
  if (!isObject(props)) return false;
  const { value1, value2, options } = props;

  if (typeof value1 !== "string" || typeof value2 !== "string") {
    return false;
  }

  if (
    isLeapSecond(value1) ||
    isLeapSecond(value2) ||
    hasCalendarAnnotation(value1) ||
    hasCalendarAnnotation(value2)
  ) {
    return false;
  }

  try {
    const zdt1 = zonedDateTimeFrom(value1);
    const zdt2 = zonedDateTimeFrom(value2);

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
