import { Temporal } from "@js-temporal/polyfill";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Parse and re-normalize an ISO 8601 duration string.
 *
 * - Uses Temporal.Duration.from to parse, then .toString() to re-emit.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 duration string
 * @param options The precision of the string written back, as Temporal's ToStringPrecisionOptions
 * @returns re-normalized ISO 8601 duration string, or "" on invalid input
 *
 * @example parseDuration("P1DT2H30M") // "P1DT2H30M"
 * @example parseDuration("PT1.5S") // "PT1.5S"
 * @example parseDuration("PT1.5S", { smallestUnit: "second" }) // "PT1S"
 * @example parseDuration("PT1.5S", { fractionalSecondDigits: 3 }) // "PT1.500S"
 * @example parseDuration("invalid") // ""
 */
export function parseDuration(
  value: string,
  options?: {
    /**
     * The smallest unit written in the string: `"second"`, `"millisecond"`, `"microsecond"` or
     * `"nanosecond"`. It sets how many fractional-second digits appear and takes precedence over
     * `fractionalSecondDigits`. `"minute"` returns `""`, as `Temporal.Duration` refuses it.
     *
     * @defaultValue None. The precision comes from `fractionalSecondDigits`.
     */
    smallestUnit?: Temporal.ToStringPrecisionOptions["smallestUnit"];
    /**
     * The number of fractional-second digits written: `0` to `9` writes exactly that many, and
     * `"auto"` writes as many as the duration needs, with no trailing zeros. It has no effect when
     * `smallestUnit` is given.
     *
     * @defaultValue `"auto"`, Temporal's default.
     */
    fractionalSecondDigits?: Temporal.ToStringPrecisionOptions["fractionalSecondDigits"];
    /**
     * How the duration is rounded when the precision asked for drops digits. `"trunc"` cuts them
     * off; `"halfExpand"` rounds to the nearest value, a half going away from zero.
     *
     * @defaultValue `"trunc"`, Temporal's default.
     */
    roundingMode?: Temporal.ToStringPrecisionOptions["roundingMode"];
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  try {
    const duration = Temporal.Duration.from(value);
    return duration.toString({
      smallestUnit: options?.smallestUnit,
      fractionalSecondDigits: options?.fractionalSecondDigits,
      roundingMode: options?.roundingMode,
    });
  } catch {
    return "";
  }
}
