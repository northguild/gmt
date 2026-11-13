// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "../../internal/temporal";
import { utcInstantOf } from "../../internal/utcInstant";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Return true if `value1` and `value2` form a valid UTC range — both parseable as
 * ISO UTC datetime strings and the instant at `value1` is before the instant at `value2`.
 *
 * - Both inputs must be ISO 8601 UTC datetime strings (e.g. `"2024-01-01T10:00:00Z"`), as
 *   `isValidUtc` accepts, annotations included.
 * - Leap-second strings return `false`.
 * - Invalid input or malformed strings return `false`.
 *
 * @param props The two ends of the range, and whether equal ends are valid
 * @returns boolean indicating whether the UTC range is valid
 *
 * @example isValidUtcRange({ value1: "2024-01-01T10:00:00Z", value2: "2024-12-31T23:59:59Z" }) // true
 * @example isValidUtcRange({ value1: "2024-12-31T23:59:59Z", value2: "2024-01-01T10:00:00Z" }) // false
 * @example isValidUtcRange({ value1: "2024-01-01T10:00:00Z", value2: "2024-01-01T10:00:00Z", options: { allowEqual: true } }) // true
 */
export function isValidUtcRange(props: {
  /** The start of the range, as an ISO UTC datetime string. */
  value1: string;
  /** The end of the range, as an ISO UTC datetime string. */
  value2: string;
  /**
   * The settings for the comparison. It must be an object or omitted; any other value, `null`
   * included, returns `false`.
   *
   * @defaultValue None. Two values at the same instant are not a valid range.
   */
  options?: {
    /**
     * Whether `value1` at the same instant as `value2` is a valid range. `false` requires `value1`
     * to be before `value2`.
     *
     * @defaultValue `false`
     */
    allowEqual?: boolean;
  };
}): boolean {
  try {
    if (!isObject(props)) return false;
    const { value1, value2, options } = props;
    if (!isOptionsArgument(options)) return false;

    if (typeof value1 !== "string" || typeof value2 !== "string") {
      return false;
    }

    const startInstant = utcInstantOf(value1);
    if (startInstant === null) {
      return false;
    }

    const endInstant = utcInstantOf(value2);
    if (endInstant === null) {
      return false;
    }

    try {
      const cmp = Temporal.Instant.compare(startInstant, endInstant);

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
