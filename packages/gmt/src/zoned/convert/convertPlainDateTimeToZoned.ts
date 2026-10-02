import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../plain/validate";
import type { Disambiguation } from "../../types";
import { isValidTimeZone } from "../validate";
import { isoStringBody, zonedDateTimeFrom } from "../../internal";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Attach the specified `timeZone` to a plain datetime string and return a zoned ISO 8601 datetime string.
 *
 * - Combines plain datetime with timezone to create ZonedDateTime.
 * - There is no `offset` option (removed in 1.16.0): Temporal `PlainDateTime#toZonedDateTime` reads
 *   only `disambiguation`, and a plain datetime has no UTC offset for `offset` to act on.
 * - **Output is cut to milliseconds by default**, so microseconds and nanoseconds in `value` are
 *   dropped. Pass `{ smallestUnit: "nanoseconds" }` to keep every digit.
 * - Returns "" for invalid input.
 *
 * @param value plain datetime string (e.g. "2024-02-29T14:30:45")
 * @param timeZone IANA name or UTC offset
 * @param optionsArg optional settings for the precision of the output string and for resolving a DST gap or overlap
 * @returns zoned ISO 8601 datetime string or "" when invalid
 *
 * @example convertPlainDateTimeToZoned("2024-02-29T14:30:45", "America/New_York") // "2024-02-29T14:30:45.000-05:00[America/New_York]"
 * @example convertPlainDateTimeToZoned("2024-02-29T14:30:45.123456789", "UTC") // "2024-02-29T14:30:45.123+00:00[UTC]"
 * @example convertPlainDateTimeToZoned("2024-02-29T14:30:45.123456789", "UTC", { smallestUnit: "nanoseconds" }) // "2024-02-29T14:30:45.123456789+00:00[UTC]"
 * @example convertPlainDateTimeToZoned("invalid", "America/New_York") // ""
 * @example convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", { disambiguation: "earlier" }) // "2024-03-10T01:30:00.000-05:00[America/New_York]" (spring-forward gap)
 * @example convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York", { disambiguation: "later" }) // "2024-11-03T01:30:00.000-05:00[America/New_York]" (fall-back overlap)
 * @example convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", { disambiguation: "reject" }) // ""
 */
export function convertPlainDateTimeToZoned(
  value: string,
  timeZone: string,
  optionsArg?: {
    /**
     * The smallest unit written in the output string, from `"minute"` to `"nanosecond"`, singular
     * or plural. Anything smaller is truncated, as Temporal's `toString` does with its `"trunc"`
     * rounding mode.
     *
     * @defaultValue `"milliseconds"`
     */
    smallestUnit?: Temporal.ZonedDateTimeToStringOptions["smallestUnit"];
    /**
     * How `value` resolves when its wall-clock time falls in a DST gap or overlap in `timeZone`. In
     * a fall-back overlap `"compatible"` and `"earlier"` take the earlier instant and `"later"` the
     * later one; in a spring-forward gap `"compatible"` and `"later"` move the wall clock forward
     * by the gap length and `"earlier"` back by it. `"reject"` returns `""` for both.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
  },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    if (!isValidDateTime(value) || !isValidTimeZone(timeZone)) {
      return "";
    }

    const disambiguation =
      optionsArg?.disambiguation === undefined
        ? "compatible"
        : optionsArg.disambiguation;

    const options: Partial<Temporal.ZonedDateTimeToStringOptions> = {
      smallestUnit:
        optionsArg?.smallestUnit === undefined
          ? "milliseconds"
          : optionsArg.smallestUnit,
    };

    try {
      const zonedDateTime = zonedDateTimeFrom(
        `${isoStringBody(value)}[${timeZone}]`,
        { disambiguation },
      );
      return zonedDateTime.toString(options);
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
