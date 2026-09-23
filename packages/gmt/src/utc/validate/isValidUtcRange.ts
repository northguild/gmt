// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "./isValidUtc";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Return true if `value1` and `value2` form a valid UTC range — both parseable as
 * ISO UTC datetime strings and the instant at `value1` is <= the instant at `value2`.
 *
 * - Both inputs must be ISO 8601 UTC datetime strings (e.g. `"2024-01-01T10:00:00Z"`), as
 *   `isValidUtc` accepts, annotations included.
 * - Equal `value1 === value2` is valid when `options.allowEqual` is true.
 * - Leap-second strings return `false`.
 * - Invalid input or malformed strings return `false`.
 *
 * @param value1 first ISO UTC datetime string
 * @param value2 second ISO UTC datetime string
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the UTC range is valid
 *
 * @example isValidUtcRange({ value1: "2024-01-01T10:00:00Z", value2: "2024-12-31T23:59:59Z" }) // true
 * @example isValidUtcRange({ value1: "2024-12-31T23:59:59Z", value2: "2024-01-01T10:00:00Z" }) // false
 * @example isValidUtcRange({ value1: "2024-01-01T10:00:00Z", value2: "2024-01-01T10:00:00Z", options: { allowEqual: true } }) // true
 */
export function isValidUtcRange(props: {
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

    if (!isValidUtc(value1) || !isValidUtc(value2)) {
      return false;
    }

    try {
      const startInstant = Temporal.Instant.from(value1);
      const endInstant = Temporal.Instant.from(value2);

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
