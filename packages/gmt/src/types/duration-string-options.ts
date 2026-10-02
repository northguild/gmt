import type { Temporal } from "@js-temporal/polyfill";

/**
 * Precision options for the ISO 8601 duration string a `diff*AsDuration` function writes, passed
 * to `Temporal.Duration.prototype.toString()`.
 *
 * They are kept apart from `RoundingOptions`, and two of them carry a `toString` prefix, because
 * both sets have a smallest unit and a rounding mode with different Temporal types: one rounds
 * the difference, the other the text written from it.
 */
export type DurationStringOptions = {
  /**
   * The smallest unit written in the string: `"second"`, `"millisecond"`, `"microsecond"` or
   * `"nanosecond"`. It sets how many fractional-second digits appear and takes precedence over
   * `fractionalSecondDigits`. `"minute"` is refused, as `Temporal.Duration` refuses it.
   *
   * @defaultValue None. The precision comes from `fractionalSecondDigits`.
   */
  toStringSmallestUnit?: Temporal.ToStringPrecisionOptions["smallestUnit"];
  /**
   * The number of fractional-second digits written: `0` to `9` writes exactly that many, and
   * `"auto"` writes as many as the duration needs, with no trailing zeros. It has no effect when
   * `toStringSmallestUnit` is given.
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
  toStringRoundingMode?: Temporal.ToStringPrecisionOptions["roundingMode"];
};
